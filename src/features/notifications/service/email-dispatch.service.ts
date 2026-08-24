import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { buildDailyEmail } from '@/features/notifications/service/daily-email.service';
import { isEmailSuppressed } from '@/features/notifications/service/email-delivery.service';
import { toDailyInput, toWelcomeInput } from '@/features/notifications/service/email-input.service';
import { buildReminderEmail } from '@/features/notifications/service/reminder-email.service';
import { buildWelcomeEmail } from '@/features/notifications/service/welcome-email.service';
import { EmailSendSummary } from '@/features/notifications/types/email.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { portalLinkForEmail } from '@/features/patient/service/portal-link.service';
import { effectiveTimeZone } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { resendClient } from '@/shared/lib/resend-client';
import { ServiceResult } from '@/shared/types/common';
import { resolvePatientLocale } from '@/shared/utils/patient-locale';

/** Patient-local hour the day's email goes out. Morning, before the first doses are usually due. */
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

    /*
      Checked here too, not only on the reminder path. A plan activated for a patient whose
      address already hard-bounced would otherwise send the largest email the product has to an
      address known to be dead, which is precisely the send that damages the sending domain.
    */
    const patient = await patientRepository.findById(
      plan.patientId.toString(),
      plan.clinicId.toString()
    );
    if (patient && isEmailSuppressed(patient)) return false;

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
/**
 * Sends one email per reminder, at the moment the reminder falls due.
 *
 * Returns a sender rather than a plain function so the patient and clinic lookups are memoised
 * for the length of one sweep. A run may carry hundreds of occurrences and they cluster heavily —
 * one patient's four daily doses, one clinic's whole caseload — so reading each row's patient and
 * clinic afresh would turn a 500-row sweep into a thousand queries.
 *
 * Exactly-once is inherited, not re-implemented: the caller only ever passes rows carrying its own
 * claim, and each row is moved out of `pending` in the same pass. There is no second guard here
 * because a second guard would be a second source of truth.
 *
 * Never throws. A reminder whose email failed still went out as a push and still stands in the
 * portal; letting a mail provider outage abort the sweep would cost every later patient in the
 * run their notification too.
 */
export function createReminderEmailSender() {
  const clinics = new Map<string, ClinicDocument | null>();
  const patients = new Map<string, Awaited<ReturnType<typeof patientRepository.findById>>>();
  /*
    One portal link per patient per sweep, not per reminder. A patient's doses cluster into the
    same run, and minting a row for each would write four identical-in-purpose credentials for one
    morning. Sharing within a run is safe because the emails go out together: whichever one the
    patient opens first is the one that gets spent, and the rest of that run's emails were never
    going to be the way back in anyway.
  */
  const portalLinks = new Map<string, string>();

  return async function sendReminderEmail(
    occurrence: ReminderOccurrenceDocument
  ): Promise<boolean> {
    try {
      const clinicId = occurrence.clinicId.toString();
      if (!clinics.has(clinicId)) clinics.set(clinicId, await clinicRepository.findById(clinicId));
      const clinic = clinics.get(clinicId) ?? null;
      if (!clinic) return false;

      const patientId = occurrence.patientId.toString();
      if (!patients.has(patientId)) {
        patients.set(patientId, await patientRepository.findById(patientId, clinicId));
      }
      const patient = patients.get(patientId) ?? null;
      if (!patient || !patient.email) return false;
      /*
        Withdrawn consent stops the send outright, before any channel question is asked.

        Distinct from suppression below in kind, not just in degree: suppression is the platform
        deciding an address cannot receive mail, and this is the patient deciding they do not want
        it. Under the Law of Georgia on Personal Data Protection a withdrawal takes effect when it
        is made, so it is checked on the send rather than applied by regenerating the plan — the
        occurrence rows stay exactly as they are, and the clinical record with them.
      */
      if (patient.notificationsRevokedAt) return false;
      /*
        Email only. The push for this occurrence has already gone out and is unaffected — a
        patient whose inbox is dead must still get the notification that can wake their phone,
        which is why suppression is a per-channel fact and not a per-patient one.
      */
      if (isEmailSuppressed(patient)) return false;

      if (!portalLinks.has(patientId)) {
        portalLinks.set(patientId, await portalLinkForEmail(patientId, patient.clinicId));
      }

      const email = buildReminderEmail({
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          // The patient's own language wins; the clinic's is the fallback for a record that
          // predates the field. Same rule the welcome and daily emails already follow.
          locale: resolvePatientLocale(patient, clinic),
        },
        clinic: {
          name: clinic.name,
          addressLine: clinic.addressLine ?? '',
          phone: clinic.phone ?? '',
          email: clinic.email ?? '',
          // The dose time this email prints is wall clock where the patient is. Printing it in the
          // clinic's zone is what told a patient recovering abroad to take a 09:30 tablet at 07:30.
          timezone: effectiveTimeZone(patient.timezone ?? '', clinic.timezone),
        },
        title: occurrence.title,
        body: occurrence.body ?? '',
        dueAt: occurrence.dueAt,
        scheduledAt: occurrence.scheduledAt ?? null,
        portalUrl: portalLinks.get(patientId),
      });

      const result = await resendClient.send({
        to: patient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (!result.ok) {
        console.error('[email] reminder failed', patientId, result.statusCode, result.message);
        return false;
      }
      return true;
    } catch (caught) {
      console.error('[email] reminder threw', caught);
      return false;
    }
  };
}

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

    /*
      Read before the morning check, not after it, because the patient is what decides when their
      morning is. The gate used to run on the clinic's zone, which skips a patient recovering east
      of their clinic for as many hours as they are ahead — their 08:00 summary arrived at 10:00
      local, or not at all on the day they travelled. It costs one extra read per plan per sweep.
    */
    const patient = await patientRepository.findById(plan.patientId.toString(), clinicId);
    if (!patient || !patient.email || isEmailSuppressed(patient)) {
      skipped += 1;
      continue;
    }

    // A withdrawal covers every automated message, not only the timed reminders. See above.
    if (patient.notificationsRevokedAt) {
      skipped += 1;
      continue;
    }

    const zone = effectiveTimeZone(patient.timezone ?? '', clinic.timezone);

    // Before the patient's own morning, or already sent for this calendar date.
    if (clock.hourInZone(now, zone) < DIGEST_HOUR) {
      skipped += 1;
      continue;
    }

    /*
      The claim key is the patient's calendar date. Someone who flies west gains hours, and their
      new local date can repeat one already claimed — which is the correct outcome: they have had
      today's summary, and a second copy of the same list is not worth the send.
    */
    const localDate = clock.dateKeyInZone(now, zone);
    if (plan.lastDigestOn === localDate) {
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
