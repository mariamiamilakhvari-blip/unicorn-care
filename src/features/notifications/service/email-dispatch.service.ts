import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { buildDailyEmail } from '@/features/notifications/service/daily-email.service';
import { toDailyInput, toWelcomeInput } from '@/features/notifications/service/email-input.service';
import { buildWelcomeEmail } from '@/features/notifications/service/welcome-email.service';
import { EmailSendSummary } from '@/features/notifications/types/email.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { clock } from '@/shared/lib/clock';
import { resendClient } from '@/shared/lib/resend-client';
import { ServiceResult } from '@/shared/types/common';

/** Clinic-local hour the day's email goes out. Morning, before the first doses are usually due. */
const DIGEST_HOUR = 8;

/** Ceiling per sweep so one run cannot exceed the function timeout. */
const DIGEST_LIMIT = 200;

/**
 * The full plan, sent once when the clinic activates it.
 *
 * Never throws and never blocks activation: a plan that is live in the app but whose email failed
 * is recoverable, whereas activation rolled back over a mail provider outage would leave the
 * patient with no reminders at all.
 */
export async function sendWelcomeEmailService(
  plan: CarePlanDocument,
  clinic: ClinicDocument
): Promise<boolean> {
  try {
    const input = await toWelcomeInput(plan, clinic);
    if (!input || !input.patient.email) return false;

    const email = buildWelcomeEmail(input);
    const result = await resendClient.send({
      to: input.patient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (!result.ok) {
      console.error('[email] welcome failed', result.statusCode, result.message);
      return false;
    }
    return true;
  } catch (caught) {
    console.error('[email] welcome threw', caught);
    return false;
  }
}

/**
 * One email per active plan per clinic-local day, carrying only that day's items.
 *
 * Runs inside the existing five-minute sweep rather than on its own schedule: each plan is claimed
 * for its own calendar date, so the sweep can run as often as it likes and a patient still receives
 * exactly one email a day, at their clinic's morning rather than at some fixed UTC hour.
 */
export async function sendDailyDigestsService(): Promise<ServiceResult<EmailSendSummary>> {
  const now = clock.now();
  const plans = await carePlanRepository.findActiveForDigest(DIGEST_LIMIT);

  const clinics = new Map<string, ClinicDocument | null>();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const plan of plans) {
    const clinicId = plan.clinicId.toString();
    if (!clinics.has(clinicId)) clinics.set(clinicId, await clinicRepository.findById(clinicId));
    const clinic = clinics.get(clinicId) ?? null;

    if (!clinic) {
      skipped += 1;
      continue;
    }

    // Before the clinic's morning, or already sent for this calendar date.
    if (clock.hourInZone(now, clinic.timezone) < DIGEST_HOUR) {
      skipped += 1;
      continue;
    }

    const localDate = clock.dateKeyInZone(now, clinic.timezone);
    if (plan.lastDigestOn === localDate) {
      skipped += 1;
      continue;
    }

    const patient = await patientRepository.findById(plan.patientId.toString(), clinicId);
    if (!patient || !patient.email || patient.isArchived) {
      skipped += 1;
      continue;
    }

    /*
      Claimed before the send, not after. Claiming afterwards would let an overlapping sweep read
      the same unclaimed plan and email the patient twice — the same race the reminder sweep had.
    */
    const claimed = await carePlanRepository.claimDigest(plan._id.toString(), localDate);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const input = await toDailyInput(plan, clinic, patient, now);
    const email = buildDailyEmail(input);
    const result = await resendClient.send({
      to: patient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      console.error('[email] digest failed', patient._id.toString(), result.statusCode, result.message);
    }
  }

  return { data: { considered: plans.length, sent, failed, skipped }, status: 200 };
}
