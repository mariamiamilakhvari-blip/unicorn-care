import { cookies } from 'next/headers';

import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';
import { AppLocale } from '@/shared/types/roles';
import { hashPassword } from '@/shared/utils/password';

export type PatientSession = {
  patientId: string;
  clinicId: string;
  locale: AppLocale;
};

/**
 * Patient portal guard (PRD 02 §B). The `uc_patient` cookie holds the raw magic-link token; only
 * its SHA-256 is at rest. Returns `null` on any failure — missing cookie, unknown token, revoked
 * token, or a patient record that no longer resolves. Never throws.
 *
 * Links do not expire, so revocation is the only thing that ends a session here.
 */
class PatientGuard {
  async requirePatient(): Promise<PatientSession | null> {
    const store = await cookies();
    const raw = store.get(PATIENT_COOKIE_NAME)?.value;
    if (!raw) return null;

    const token = await patientAccessTokenRepository.findByTokenHash(hashPassword(raw));
    if (!token) return null;
    if (token.revokedAt) return null;

    const patientId = token.patientId.toString();
    const clinicId = token.clinicId.toString();

    const patient = await patientRepository.findById(patientId, clinicId);
    if (!patient) return null;

    return { patientId, clinicId, locale: patient.locale };
  }
}

export const patientGuard = new PatientGuard();
export { PatientGuard };
