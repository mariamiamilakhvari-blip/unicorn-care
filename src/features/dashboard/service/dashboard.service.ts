import { ClinicOverview } from '@/features/dashboard/types/dashboard.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { ServiceResult } from '@/shared/types/common';

/**
 * The dashboard landing shows only numbers we actually hold. Anything the schema cannot answer
 * honestly (trend deltas, "vs last month") is left off rather than fabricated — a clinic reading
 * an invented adherence figure is worse than a clinic reading none.
 */
export async function getClinicOverviewService(
  clinicId: string
): Promise<ServiceResult<ClinicOverview>> {
  const { items, total } = await patientRepository.findAllByClinic(clinicId, 1, 5);

  return {
    data: {
      patientCount: total,
      recentPatients: items.map(patient => ({
        id: patient._id.toString(),
        name: `${patient.firstName} ${patient.lastName}`,
      })),
    },
    status: 200,
  };
}
