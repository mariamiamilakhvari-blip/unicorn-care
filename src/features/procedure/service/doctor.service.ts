import { userRepository } from '@/features/auth/repository/user.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { DoctorView } from '@/features/procedure/types/doctor.types';
import { ServiceResult } from '@/shared/types/common';

/** Clinic rosters are small; one read covers every patient referenced by the grouped procedures. */
const PATIENT_PAGE_LIMIT = 1000;

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The clinic's doctors, derived from the operating surgeon recorded on each procedure.
 *
 * Nothing here is a separate list to maintain: log "Dr Nino Kechakmadze performed a rhinoplasty on
 * Lika" and the doctor appears, with that procedure and that patient attached. Staff accounts are
 * matched in by name where one exists, so the list shows both who operates and who can sign in.
 */
export async function listDoctorsService(
  clinicId: string
): Promise<ServiceResult<{ items: DoctorView[] }>> {
  const groups = await procedureRepository.aggregateByOperator(clinicId);
  if (groups.length === 0) return { data: { items: [] }, status: 200 };

  const { items: patients } = await patientRepository.findAllByClinic(clinicId, 1, PATIENT_PAGE_LIMIT);
  const patientsById = new Map(
    patients.map(patient => [
      patient._id.toString(),
      `${patient.firstName} ${patient.lastName}`.trim(),
    ])
  );

  const staff = await userRepository.findAllByClinic(clinicId);
  const staffByName = new Map(staff.map(member => [normalise(member.name), member]));

  const items: DoctorView[] = groups.map(group => {
    const account = staffByName.get(group._id);

    return {
      // A matched account is the authoritative spelling. Procedure entries are typed per case and
      // drift in casing, so the most recent one is not necessarily the tidiest.
      name: account?.name ?? group.displayName,
      procedureCount: group.procedureCount,
      manipulationTypes: group.manipulationTypes,
      lastPerformedAt: group.lastPerformedAt.toISOString(),
      patients: group.patientIds
        .map(id => ({ id: id.toString(), name: patientsById.get(id.toString()) ?? '' }))
        // A patient archived or removed since the procedure leaves no name to show.
        .filter(patient => patient.name.length > 0),
      hasAccount: Boolean(account),
      jobTitle: account?.jobTitle ?? '',
    };
  });

  return { data: { items }, status: 200 };
}
