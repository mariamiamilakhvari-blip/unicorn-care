import { ClinicOverview, UnreachablePatient } from '@/features/dashboard/types/dashboard.types';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { ServiceResult } from '@/shared/types/common';

/**
 * Patients in active care that no reminder can reach.
 *
 * Two queries, not one per patient: the shortlist is everyone whose email cannot carry a
 * reminder, and their push subscriptions are then looked up together. Most patients have a
 * working address, so the shortlist is small and the second query is smaller still.
 *
 * A patient with push and no address is reachable and never appears here. Push is the rarer
 * channel — it needs a permission prompt most people decline — but it is a real one, and a
 * banner that cried wolf about patients who are receiving everything would stop being read.
 */
async function findUnreachable(clinicId: string): Promise<UnreachablePatient[]> {
  const candidates = await patientRepository.findWithUnusableEmail(clinicId);
  if (candidates.length === 0) return [];

  const withPush = new Set(
    await pushSubscriptionRepository.findPatientIdsWithActive(
      candidates.map(patient => patient._id.toString())
    )
  );

  return candidates
    .filter(patient => !withPush.has(patient._id.toString()))
    .map(patient => ({
      id: patient._id.toString(),
      name: `${patient.firstName} ${patient.lastName}`.trim(),
      // Suppression is the more specific fact, so it wins when an address exists but is blocked.
      reason: patient.emailSuppressedAt ? ('EMAIL_SUPPRESSED' as const) : ('NO_CONTACT_METHOD' as const),
    }));
}

/**
 * The dashboard landing shows only numbers we actually hold. Anything the schema cannot answer
 * honestly (trend deltas, "vs last month") is left off rather than fabricated — a clinic reading
 * an invented adherence figure is worse than a clinic reading none.
 */
export async function getClinicOverviewService(
  clinicId: string
): Promise<ServiceResult<ClinicOverview>> {
  const { items, total } = await patientRepository.findAllByClinic(clinicId, 1, 5);
  const unreachable = await findUnreachable(clinicId);

  return {
    data: {
      patientCount: total,
      recentPatients: items.map(patient => ({
        id: patient._id.toString(),
        name: `${patient.firstName} ${patient.lastName}`,
      })),
      unreachable,
    },
    status: 200,
  };
}
