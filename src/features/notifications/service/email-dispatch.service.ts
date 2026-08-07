import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { buildDailyEmail } from '@/features/notifications/service/daily-email.service';
import { toDailyInput, toWelcomeInput } from '@/features/notifications/service/email-input.service';
import { buildReminderEmail } from '@/features/notifications/service/reminder-email.service';
import { buildWelcomeEmail } from '@/features/notifications/service/welcome-email.service';
import { EmailSendSummary } from '@/features/notifications/types/email.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { clock } from '@/shared/lib/clock';
import { resendClient } from '@/shared/lib/resend-client';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

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
      if (!patient || !patient.email || patient.isArchived) return false;

      const email = buildReminderEmail({
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          // The patient's own language wins; the clinic's is the fallback for a record that
          // predates the field. Same rule the welcome and daily emails already follow.
          locale: (patient.locale ?? clinic.locale) as AppLocale,
        },
        clinic: {
          name: clinic.name,
          addressLine: clinic.addressLine ?? '',
          phone: clinic.phone ?? '',
          email: clinic.email ?? '',
          timezone: clinic.timezone,
        },
        title: occurrence.title,
        body: occurrence.body ?? '',
        dueAt: occurrence.dueAt,
        portalUrl: `${SITE_URL}${PATIENT_PORTAL_ROUTE}`,
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
