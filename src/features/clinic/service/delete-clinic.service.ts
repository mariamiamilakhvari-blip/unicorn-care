import { passwordResetTokenRepository } from '@/features/auth/repository/password-reset-token.repository';
import { userRepository } from '@/features/auth/repository/user.repository';
import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { DeleteClinicResult } from '@/features/clinic/types/clinic.types';
import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { dataRequestRepository } from '@/features/data-protection/repository/data-request.repository';
import { emailEventRepository } from '@/features/notifications/repository/email-event.repository';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { blobClient } from '@/shared/lib/blob-client';
import { dodoClient } from '@/shared/lib/dodo-client';
import { ServiceResult } from '@/shared/types/common';

/** Clinic rosters are small; one page covers every patient a clinic has ever had. */
const PURGE_PAGE_LIMIT = 5000;

/**
 * Deletes a clinic account: its subscription, its clinical records, its staff logins.
 *
 * Irreversible, and it destroys patient medical records, so two things guard it. The route admits
 * owners only, and the caller must repeat the clinic's name exactly — a mistyped confirmation is a
 * 422, not a deletion. Clinics may have their own retention obligations for post-operative records;
 * that judgement belongs to the clinic, which is why the confirmation is deliberate rather than a
 * single click.
 *
 * Billing is cancelled BEFORE anything is deleted, and a failure there aborts the whole operation.
 * Deleting first would leave a clinic with no account, no way back in, and a subscription still
 * charging them every month — the one outcome worse than the deletion failing outright.
 */
export async function deleteClinicService(
  clinicId: string,
  confirmationName: string
): Promise<ServiceResult<DeleteClinicResult>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  // Compared on trimmed text so trailing whitespace is not a trap, but case must match.
  if (confirmationName.trim() !== clinic.name.trim()) {
    return { data: { error: 'CONFIRMATION_MISMATCH' }, status: 422 };
  }

  let subscriptionCancelled = false;

  if (clinic.dodoSubscriptionId) {
    const cancelled = await dodoClient.cancelSubscription(clinic.dodoSubscriptionId);
    if (!cancelled.ok) {
      console.error('[clinic] refusing to delete, cancel failed', {
        clinicId,
        statusCode: cancelled.statusCode,
        message: cancelled.message,
      });
      return { data: { error: 'SUBSCRIPTION_CANCEL_FAILED' }, status: 502 };
    }
    subscriptionCancelled = true;
  }

  /*
    Reminder occurrences go first and the clinic itself last. The dispatch sweep reads occurrences
    without a clinic scope, so removing them up front stops it touching rows whose clinic is
    half-deleted; leaving the clinic row until the end means a crash midway is still recognisable
    as an incomplete deletion rather than orphaned records with no owner.
  */
  /*
    The ids of everything hanging off this clinic that is NOT reachable by `clinicId`, captured
    before the rows that carry them are removed.

    Push subscriptions are keyed only by patient and reset tokens only by user, so a cascade
    written around `clinicId` alone cannot see either. Both outlived their owners: a push endpoint
    still pointing at a deleted patient, and a live reset credential belonging to a user with no
    account. Reading the ids first is the whole reason this is not one pass.
  */
  const { items: doomedPatients } = await patientRepository.findAllByClinic(clinicId, 1, PURGE_PAGE_LIMIT);
  const doomedPatientIds = doomedPatients.map(patient => patient._id.toString());
  const doomedStaff = await userRepository.findAllByClinic(clinicId);
  const doomedStaffIds = doomedStaff.map(member => member._id.toString());

  const reminders = await reminderOccurrenceRepository.deleteAllByClinic(clinicId);
  const carePlans = await carePlanRepository.deleteAllByClinic(clinicId);
  const procedures = await procedureRepository.deleteAllByClinic(clinicId);
  const patients = await patientRepository.deleteAllByClinic(clinicId);
  const recoveryGuides = await recoveryGuideRepository.deleteAllByClinic(clinicId);
  /*
    Delivery events name a patient and their email address, so they are patient data and go with
    the rest. Leaving them would keep a record of who a deleted clinic's patients were, and of
    addresses that were never ours to retain past the account.
  */
  await emailEventRepository.deleteAllByClinic(clinicId);
  /*
    Ratings name the patient who wrote them and the doctor they are about, so they go too. There
    is no argument for keeping a deleted clinic's reviews: nothing left will ever display them,
    and the patients who wrote them no longer have an account here either.
  */
  await ratingRepository.deleteAllByClinic(clinicId);
  /*
    Photographs are deleted in two steps because there are two copies. The rows go with the rest
    of the clinical record, but the bytes live in Blob and would survive the account outright —
    post-operative photographs of a patient's body, still stored, belonging to nothing.
  */
  await recoveryLogRepository.deleteAllByClinic(clinicId);
  const photos = await patientPhotoRepository.findAllByClinic(clinicId);
  for (const photo of photos) await blobClient.remove(photo.pathname);
  await patientPhotoRepository.deleteAllByClinic(clinicId);
  // Who looked at those photographs, and when. A patient-data access log outliving the photographs
  // it describes is a record of a deleted patient by another name.
  await photoAccessEventRepository.deleteAllByClinic(clinicId);
  /*
    Portal credentials. Neither would still authenticate anything once the patient rows are gone —
    `patientGuard` resolves the patient before it trusts a token — but they are live-looking
    credentials naming a patient, and there is no reason for them to survive the account.
  */
  await patientAccessTokenRepository.deleteAllByClinic(clinicId);
  await patientPortalLinkRepository.deleteAllByClinic(clinicId);
  // What a patient reported about their own recovery: health data, and among the most sensitive here.
  await symptomReportRepository.deleteAllByClinic(clinicId);
  /*
    The data-protection record itself. Both repositories already had a `deleteAllByClinic` and
    neither was ever called — so a clinic could be deleted while the proof of what its patients
    consented to, and the requests they had filed, stayed behind indefinitely.
  */
  await consentRecordRepository.deleteAllByClinic(clinicId);
  await dataRequestRepository.deleteAllByClinic(clinicId);
  // Keyed by patient and by user respectively — see the ids captured at the top.
  await pushSubscriptionRepository.deleteAllByPatients(doomedPatientIds);
  await passwordResetTokenRepository.deleteAllByUsers(doomedStaffIds);
  const staff = await userRepository.deleteAllByClinic(clinicId);

  await clinicRepository.deleteById(clinicId);

  return {
    data: {
      deleted: true,
      subscriptionCancelled,
      counts: { patients, procedures, carePlans, reminders, recoveryGuides, staff },
    },
    status: 200,
  };
}
