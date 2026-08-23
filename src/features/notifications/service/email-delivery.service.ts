import { emailEventRepository } from '@/features/notifications/repository/email-event.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import {
  EmailEventKind,
  HARD_BOUNCE_TYPES,
  SOFT_BOUNCE_LIMIT,
  SuppressionReason,
} from '@/shared/const/email-delivery.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/** One provider event, already parsed out of the webhook body. */
export type EmailDeliveryEvent = {
  kind: EmailEventKind;
  email: string;
  /** The provider's own bounce classification, verbatim. */
  bounceType: string;
  message: string;
  providerId: string;
  occurredAt: Date;
};

export type EmailDeliveryResult = {
  recorded: boolean;
  suppressed: boolean;
  reason: SuppressionReason;
  /** How many patient records hold the address this event was about. Usually one. */
  patients: number;
};

/**
 * Whether a patient may be emailed.
 *
 * A field read on a record every send already loads, which is why suppression lives on the
 * patient rather than in a lookup: the check has to be free, or it will eventually be skipped on
 * some path to save a query.
 */
export function isEmailSuppressed(patient: PatientDocument): boolean {
  return patient.emailSuppressedAt !== null && patient.emailSuppressedAt !== undefined;
}

/** Permanent unless the provider says otherwise — see `HARD_BOUNCE_TYPES` for why that direction. */
function isHardBounce(bounceType: string): boolean {
  return HARD_BOUNCE_TYPES.some(known => known.toLowerCase() === bounceType.toLowerCase());
}

/**
 * Records a delivery event and updates the address's standing.
 *
 * The rules, and why each is what it is:
 *
 * - **Hard bounce → suppressed at once.** The mailbox does not exist. Retrying cannot succeed and
 *   every attempt costs the sending domain, which is shared by every clinic on the platform.
 * - **Complaint → suppressed at once, and never lifted automatically.** Someone pressed "spam".
 *   Resuming without them asking is how a domain gets blocked outright.
 * - **Soft bounce → counted, suppressed at the threshold.** Temporary by definition, so one must
 *   not stop a patient's reminders; a run of them is not temporary any more.
 * - **Delivered → the soft-bounce run resets.** The count measures a consecutive run, and a
 *   mailbox that accepted a message is no longer failing.
 *
 * A delivery never lifts an existing suppression. Hard bounces and complaints are decisions about
 * the address, not observations of one bad day, and clearing them silently would resume sending
 * to someone who asked to be left alone. The clinic lifts a suppression, deliberately.
 *
 * **Applied to every patient holding the address, not to one of them.** A patient is a clinic's
 * record rather than a login, so the same address can sit on several — a family sharing an inbox,
 * a clinic entering its own, one person treated at two clinics. The `findOne` this replaced picked
 * whichever row the index yielded, so a bounce marked an arbitrary patient unreachable while the
 * one whose message actually bounced kept being sent to. Both halves of that were wrong, and the
 * visible half was a patient flagged on their own page for a failure that was never theirs.
 *
 * The soft-bounce counter stays per patient. It measures a consecutive run of failures against a
 * mailbox, and each record reached it through its own sends, so pooling the counts would suppress
 * an address in a fraction of the intended allowance.
 *
 * Never throws: this is called from a webhook, and a 500 makes the provider retry an event that
 * has already been recorded.
 */
export async function recordEmailDeliveryEventService(
  event: EmailDeliveryEvent
): Promise<ServiceResult<EmailDeliveryResult>> {
  const matched = await patientRepository.findAllByEmail(event.email);
  if (matched.length === 0) {
    // Not an error: the provider also delivers mail this system did not send a patient.
    return { data: { recorded: false, suppressed: false, reason: '', patients: 0 }, status: 200 };
  }

  /*
    Webhook delivery is at-least-once, so the same bounce can arrive twice. Without this, one
    bounce could increment the soft-bounce run repeatedly and suppress an address that failed once.

    Checked once for the event rather than once per patient: the provider id identifies the
    message, and one message is one event however many records happen to hold its address.
  */
  if (event.providerId && (await emailEventRepository.existsByProviderId(event.providerId))) {
    return {
      data: {
        recorded: false,
        suppressed: matched.some(isEmailSuppressed),
        reason: '',
        patients: matched.length,
      },
      status: 200,
    };
  }

  const hard = event.kind === 'bounced' && isHardBounce(event.bounceType);

  let suppressedAny = false;
  let reason: SuppressionReason = '';

  for (const patient of matched) {
    const applied = await applyDeliveryEvent(patient, event, hard);
    if (applied) {
      suppressedAny = true;
      // The first reason reached. They can differ only when one record is over the soft-bounce
      // threshold and another is not, and the response reports the event, not the per-record split.
      reason = reason || applied;
    }
  }

  if (event.kind === 'delivered') {
    return {
      data: {
        recorded: true,
        suppressed: matched.some(isEmailSuppressed),
        reason: '',
        patients: matched.length,
      },
      status: 200,
    };
  }

  return {
    data: { recorded: true, suppressed: suppressedAny, reason, patients: matched.length },
    status: 200,
  };
}

/**
 * One event against one record: the delivery log row, then the standing.
 *
 * Returns the reason this record was suppressed, or `''` if it was not. Every write is scoped to
 * the single patient, so a shared address never lets one record's history decide another's.
 */
async function applyDeliveryEvent(
  patient: PatientDocument,
  event: EmailDeliveryEvent,
  hard: boolean
): Promise<SuppressionReason> {
  await emailEventRepository.create({
    patientId: patient._id,
    clinicId: patient.clinicId,
    email: event.email,
    kind: event.kind,
    bounceType: event.kind === 'bounced' ? (hard ? 'hard' : 'soft') : '',
    message: event.message,
    providerId: event.providerId,
    occurredAt: event.occurredAt,
  });

  const softBounces = patient.emailSoftBounces ?? 0;

  if (event.kind === 'delivered') {
    // Resets the run. Deliberately does not lift a suppression — see the note above.
    if (softBounces > 0) {
      await patientRepository.updateDeliveryState(patient._id.toString(), { emailSoftBounces: 0 });
    }
    return '';
  }

  let reason: SuppressionReason = '';
  if (event.kind === 'complained') reason = 'complaint';
  else if (hard) reason = 'hard_bounce';
  else if (softBounces + 1 >= SOFT_BOUNCE_LIMIT) reason = 'soft_bounce';

  if (!reason) {
    await patientRepository.updateDeliveryState(patient._id.toString(), {
      emailSoftBounces: softBounces + 1,
    });
    return '';
  }

  await patientRepository.updateDeliveryState(patient._id.toString(), {
    emailSuppressedAt: clock.now(),
    emailSuppressionReason: reason,
    emailSoftBounces: event.kind === 'bounced' && !hard ? softBounces + 1 : softBounces,
  });

  return reason;
}

/**
 * Lifts a suppression, at the clinic's instruction.
 *
 * Always the clinic and never the platform, because the fix lives with them: the address was
 * wrong and they have corrected it, or they have spoken to the patient. Resetting the soft-bounce
 * run alongside gives the address a full allowance rather than one attempt before it trips again.
 */
export async function clearEmailSuppressionService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<{ cleared: true }>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  await patientRepository.updateDeliveryState(patientId, {
    emailSuppressedAt: null,
    emailSuppressionReason: '',
    emailSoftBounces: 0,
  });

  return { data: { cleared: true }, status: 200 };
}
