import { userRepository } from '@/features/auth/repository/user.repository';
import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { DeleteClinicResult } from '@/features/clinic/types/clinic.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { dodoClient } from '@/shared/lib/dodo-client';
import { ServiceResult } from '@/shared/types/common';

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
  const reminders = await reminderOccurrenceRepository.deleteAllByClinic(clinicId);
  const carePlans = await carePlanRepository.deleteAllByClinic(clinicId);
  const procedures = await procedureRepository.deleteAllByClinic(clinicId);
  const patients = await patientRepository.deleteAllByClinic(clinicId);
  const recoveryGuides = await recoveryGuideRepository.deleteAllByClinic(clinicId);
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
