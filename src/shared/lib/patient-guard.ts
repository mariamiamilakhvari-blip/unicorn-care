import { cookies } from 'next/headers';

import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { ERASED_PLACEHOLDER } from '@/shared/const/retention.const';
import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';
import { AppLocale } from '@/shared/types/roles';
import { hashPassword } from '@/shared/utils/password';

export type PatientSession = {
  patientId: string;
  clinicId: string;
  locale: AppLocale;
  /**
   * Whose plan this session opens, for the portal to say so on screen.
   *
   * Free here: the guard already loads the patient record to check portal consent, so the name
   * comes off a document it is holding rather than out of a second query on every request.
   *
   * Empty when the record has been erased, never the literal `[ERASED]` placeholder — the portal
   * then says the account is closed rather than printing a marker at somebody.
   */
  patientName: string;
};

/**
 * Patient portal guard (PRD 02 §B). The `uc_patient` cookie holds the raw magic-link token; only
 * its SHA-256 is at rest. Returns `null` on any failure — missing cookie, unknown token, revoked
 * token, withdrawn portal consent, or a patient record that no longer resolves. Never throws.
 *
 * Links do not expire, so revocation is the only thing that ends a session here — and it comes in
 * two forms. A revoked *token* is the clinic cutting off one link; a withdrawn *portal consent* is
 * the patient closing the whole channel, which has to hold against every link they were ever sent
 * and so is checked on the record rather than on the token.
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
    /*
      The patient closed this channel themselves. Treated as no session at all rather than as a
      distinguishable refusal, which is the same reasoning the token checks above follow: the
      portal must not become a way to learn anything about a record it will not show.

      Re-granting is done by the clinic, not from inside the portal — someone who cannot get in
      cannot toggle a switch that lives behind the door.
    */
    if (patient.portalAccessRevokedAt) return null;

    const isErased = patient.firstName === ERASED_PLACEHOLDER;
    const patientName = isErased ? '' : `${patient.firstName} ${patient.lastName}`.trim();

    return { patientId, clinicId, locale: patient.locale, patientName };
  }
}

export const patientGuard = new PatientGuard();
export { PatientGuard };
