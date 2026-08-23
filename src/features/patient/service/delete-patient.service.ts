import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { emailEventRepository } from '@/features/notifications/repository/email-event.repository';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { DeletePatientResult } from '@/features/patient/types/patient.types';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { blobClient } from '@/shared/lib/blob-client';
import { ServiceResult } from '@/shared/types/common';
import { confirmationMatches } from '@/shared/utils/confirmation-name';

/**
 * Erases one patient and everything the clinic holds about them.
 *
 * This replaces archiving, which only set `isArchived` and hid the row from the list. That was the
 * right default for a clinic tidying its caseload and the wrong one for a patient asking to be
 * erased: under the Law of Georgia on Personal Data Protection a withdrawal takes effect when it
 * is made, and a hidden record is still a held record.
 *
 * Every read here is scoped by `clinicId` as well as `patientId`, so a guessed id belonging to
 * another clinic deletes nothing and answers 404 — the same rule the rest of the feature follows,
 * and it matters more here than anywhere else in the codebase.
 *
 * Unconditional once the name is typed. An active plan, a checkup still scheduled, reminders still
 * pending, a rating already published — none of them hold the record back, and none of them is
 * checked. That is the point: a withdrawal takes effect when it is made, so a patient still mid-
 * course is precisely the case that must work. There is no referential integrity in MongoDB to
 * refuse this either; the ordering below is the only dependency that exists, and it is about what
 * a crash leaves behind rather than about what is permitted.
 *
 * Irreversible, and it destroys clinical history: the plans, the adherence record, the
 * post-operative photographs. Guarded by a typed confirmation of the patient's own name, the same
 * gate account deletion uses — a confirm dialog is one click, and none of this comes back.
 */
export async function deletePatientService(
  clinicId: string,
  patientId: string,
  confirmationName: string
): Promise<ServiceResult<DeletePatientResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  /*
    Compared on normalised whitespace so neither a trailing space nor a doubled one is a trap, but
    case must match — the same rule account deletion uses. Trimming alone was not enough: nothing
    trims the name fields at intake, so a stored `"tamar "` yields `"tamar  amilakhvari"`, which the
    browser renders with one space and no caller can ever reproduce. Checked after the patient is
    read, because the name being confirmed is the one on the record rather than anything the caller
    supplied about it.
  */
  const fullName = `${patient.firstName} ${patient.lastName}`;
  if (!confirmationMatches(confirmationName, fullName)) {
    return { data: { error: 'CONFIRMATION_MISMATCH' }, status: 422 };
  }

  /*
    The plans are read before anything is removed, because they are what the occurrence sweep below
    needs and they are gone by the end of this function. Every plan, not the active ones — a
    finished course leaves rows behind exactly like a running one.
  */
  const plans = await carePlanRepository.findAllByPatient(patientId, clinicId);

  /*
    Occurrences first, and the patient row last, for the reason the clinic cascade gives: the
    dispatch sweep reads occurrences with no clinic scope, so clearing them up front stops a run
    picking up reminders for a patient who is halfway deleted. Leaving the patient row until the
    end keeps a crash midway recognisable as an incomplete deletion rather than orphaned rows.

    Swept twice, by patient and then by each of their plans. The second pass is not redundant: an
    occurrence carries `patientId` and `carePlanId` independently, so a row whose patient reference
    is missing or stale — a legacy row, a plan whose patient was corrected — survives the first
    filter and would then sit in the dispatch queue pointing at a patient who no longer exists.
    `deleteMany` on an already-empty match costs a query and returns zero, which is the right price
    for that not happening.
  */
  let reminders = await reminderOccurrenceRepository.deleteAllByPatient(patientId, clinicId);
  for (const plan of plans) {
    reminders += await reminderOccurrenceRepository.deleteAllByCarePlan(
      plan._id.toString(),
      clinicId
    );
  }

  const carePlans = await carePlanRepository.deleteAllByPatient(patientId, clinicId);
  const procedures = await procedureRepository.deleteAllByPatient(patientId, clinicId);

  /*
    Photographs are two deletes, not one. The rows go with the clinical record; the bytes live in
    Blob and would otherwise outlive the patient entirely — post-operative photographs of someone's
    body, still stored, belonging to a record that no longer exists.
  */
  const photos = await patientPhotoRepository.findByPatient(patientId, clinicId);
  for (const photo of photos) await blobClient.remove(photo.pathname);
  await patientPhotoRepository.deleteAllByPatient(patientId, clinicId);
  // The access log for those photographs is a record of the patient by another name.
  await photoAccessEventRepository.deleteAllByPatient(patientId, clinicId);

  await recoveryLogRepository.deleteAllByPatient(patientId, clinicId);
  await symptomReportRepository.deleteAllByPatient(patientId, clinicId);

  /*
    Ratings go too, which also removes this patient's contribution from the public boards — the
    aggregation reads the rows, so there is no separate cache to invalidate. The clinic's stored
    `avgClinicScore` is denormalised and is left as it was; it is recomputed from the ratings on
    the next submission, and the boards aggregate live rather than reading it.
  */
  const ratings = await ratingRepository.deleteAllByPatient(patientId, clinicId);

  // Portal credentials, and the delivery log naming their email address.
  await patientAccessTokenRepository.deleteAllByPatient(patientId, clinicId);
  await patientPortalLinkRepository.deleteAllByPatient(patientId, clinicId);
  await pushSubscriptionRepository.deleteAllByPatients([patientId]);
  await emailEventRepository.deleteAllByPatient(patientId, clinicId);
  // The consent record itself: proof of what they agreed to, which cannot outlive the person.
  await consentRecordRepository.deleteAllByPatient(patientId, clinicId);

  await patientRepository.deleteById(patientId, clinicId);

  return {
    data: {
      deleted: true,
      counts: { procedures, carePlans, reminders, ratings, photos: photos.length },
    },
    status: 200,
  };
}
