import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { toEmailClinic } from '@/features/notifications/service/email-clinic.service';
import { isEmailSuppressed } from '@/features/notifications/service/email-delivery.service';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  issuePortalLink,
  NOTIFICATION_LINK_TTL_MINUTES,
} from '@/features/patient/service/portal-link.service';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { resolvePatientLocale } from '@/shared/utils/patient-locale';

const MS_PER_MINUTE = 60 * 1000;

/**
 * One day past the last day of rehab.
 *
 * `rehabEndsAt` is the end of the recovery the plan describes, and a link that died at midnight on
 * that exact instant would go dead while the patient was still reading the final day's tasks. A
 * day is enough to cover the tail of it without turning the link into a standing key.
 */
const GRACE_DAYS_AFTER_REHAB = 1;

/**
 * How long this patient's link should live, and the date to print on it.
 *
 * Cut to the plan rather than to a fixed month. The link's whole purpose is to let somebody read
 * the plan they are currently living on, so the recovery it describes is the natural end of it —
 * a patient six weeks into a twelve-week rehab should not be handed a credential that dies
 * halfway, and one whose rehab ends on Friday has no use for a month.
 *
 * Falls back to the fixed window in the two cases where the plan cannot answer: no end date on the
 * record, and a rehab that has already finished. Both return a null date, so the email states a
 * duration instead of naming a day that would be wrong or already past.
 */
function linkWindowFor(
  plan: CarePlanDocument,
  now: Date
): { ttlMinutes: number; activeUntil: Date | null } {
  const fixed = { ttlMinutes: NOTIFICATION_LINK_TTL_MINUTES, activeUntil: null };

  if (!plan.rehabEndsAt) return fixed;

  const activeUntil = clock.addDays(plan.rehabEndsAt, GRACE_DAYS_AFTER_REHAB);
  const ttlMinutes = Math.ceil((activeUntil.getTime() - now.getTime()) / MS_PER_MINUTE);

  // The rehab is already over. The plan is still readable, so the patient still gets a link.
  if (ttlMinutes <= 0) return fixed;

  return { ttlMinutes, activeUntil };
}

/**
 * Emails the patient a fresh way into their portal, because what they were looking at has changed.
 *
 * Sent when a clinic saves an edit to a plan the patient is already living on. The link they were
 * last sent is single-use and most likely already spent, so a patient told "your plan was updated"
 * and handed a dead link is a patient who cannot read the update. This is the one place a *clinic*
 * action mints a patient credential without the patient asking for it.
 *
 * Deliberately not the welcome email, which carries the plan in full. That one is sent once, on
 * the transition into `active`, precisely so a dosage typo does not re-send the largest email the
 * product has to somebody who already read it. This is the small one: a door, not a document.
 *
 * The link lasts as long as the recovery it opens — see `linkWindowFor`. Nobody is waiting by
 * their phone for this: it goes out when the clinic happens to save an edit, and a patient who
 * reads their mail at the weekend must still find a door rather than a second dead link. The link
 * is still single-use — walking through it spends it and sets the session cookie, and the schema's
 * TTL index then deletes the row.
 *
 * Never throws and never fails the save. A plan edit rolled back because a mail provider was down
 * would leave the clinic's correction unapplied, which is strictly worse than an email that did
 * not arrive — the patient still holds any session they already unlocked, and every later reminder
 * carries its own link.
 *
 * Silent on a patient who cannot or should not receive it: no address, an address the platform
 * knows is dead, a withdrawn notification consent, or a portal the clinic has closed. Those are
 * the gates every other patient email passes, and this one is not special enough to skip them just
 * because a clinic user was at the keyboard.
 */
export async function sendPlanUpdatedLinkService(
  plan: CarePlanDocument,
  clinic: ClinicDocument
): Promise<boolean> {
  try {
    const clinicId = plan.clinicId.toString();
    const patientId = plan.patientId.toString();

    const patient = await patientRepository.findById(patientId, clinicId);
    if (!patient?.email) return false;
    if (patient.notificationsRevokedAt) return false;
    if (patient.portalAccessRevokedAt) return false;
    if (isEmailSuppressed(patient)) return false;

    const window = linkWindowFor(plan, clock.now());

    const portalUrl = await issuePortalLink(patientId, plan.clinicId, window.ttlMinutes);

    // The patient's own language wins; the clinic's is the fallback for a record that predates
    // the field. Same rule the welcome, daily and reminder emails follow.
    const locale = resolvePatientLocale(patient, clinic);

    return await sendPortalLinkEmailService({
      to: patient.email,
      locale,
      clinic: toEmailClinic(clinic, locale, clinic.timezone || DEFAULT_TIMEZONE),
      portalUrl,
      ttlHours: window.ttlMinutes / 60,
      activeUntil: window.activeUntil,
    });
  } catch (caught) {
    console.error('[email] plan-updated link threw', plan._id.toString(), caught);
    return false;
  }
}
