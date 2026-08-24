import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { isEmailSuppressed } from '@/features/notifications/service/email-delivery.service';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  issuePortalLink,
  NOTIFICATION_LINK_TTL_MINUTES,
} from '@/features/patient/service/portal-link.service';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';
import { AppLocale } from '@/shared/types/roles';

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
 * Given the notification lifetime rather than the requested-link one, which is a day. Nobody is
 * waiting by their phone for this: it goes out when the clinic happens to save an edit, and a
 * patient who reads their mail at the weekend must still find a door rather than a second dead
 * link. A month is the span of a recovery, and the link is still single-use — walking through it
 * spends it, and the schema's TTL index then deletes the row.
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

    const portalUrl = await issuePortalLink(
      patientId,
      plan.clinicId,
      NOTIFICATION_LINK_TTL_MINUTES
    );

    return await sendPortalLinkEmailService({
      to: patient.email,
      // The patient's own language wins; the clinic's is the fallback for a record that predates
      // the field. Same rule the welcome, daily and reminder emails follow.
      locale: (patient.locale ?? clinic.locale) as AppLocale,
      clinic: {
        name: clinic.name,
        addressLine: clinic.addressLine ?? '',
        phone: clinic.phone ?? '',
        email: clinic.email ?? '',
        timezone: clinic.timezone || DEFAULT_TIMEZONE,
      },
      portalUrl,
      ttlHours: NOTIFICATION_LINK_TTL_MINUTES / 60,
    });
  } catch (caught) {
    console.error('[email] plan-updated link threw', plan._id.toString(), caught);
    return false;
  }
}
