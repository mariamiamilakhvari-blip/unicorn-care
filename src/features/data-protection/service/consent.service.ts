import mongoose from 'mongoose';

import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { ConsentRecordDocument } from '@/features/data-protection/schema/consent-record.schema';
import {
  ConsentChangeResult,
  ConsentSettingsView,
  ConsentView,
} from '@/features/data-protection/types/data-protection.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  ConsentSource,
  ConsentType,
  PATIENT_REVOCABLE_CONSENTS,
} from '@/shared/const/consent-type.const';
import { CONSENT_VERSION } from '@/shared/const/consent.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/**
 * Consent state, kept in two places on purpose.
 *
 * `ConsentRecord` is the evidence and the history — what was agreed to, on what wording, when, and
 * when it was withdrawn. `Patient.notificationsRevokedAt` is the *decision*, denormalised onto the
 * record every send already loads. The dispatcher reads the second: a sweep carries five hundred
 * occurrences and cannot afford an audit-log query per row, and it already has the patient in hand
 * to check email suppression. The same reasoning the delivery fields on `Patient` are built on.
 *
 * Every write below sets both, in that order — the audit row first, then the flag. If the process
 * dies between them the patient keeps receiving reminders they asked to stop, which is wrong but
 * recoverable; the reverse order would silently stop a patient's reminders with nothing on record
 * to say why, which is neither.
 */

function toView(record: ConsentRecordDocument): ConsentView {
  const type = record.consentType as ConsentType;
  return {
    type,
    source: record.source as ConsentSource,
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    consentTextVersion: record.consentTextVersion,
    isRevocable: PATIENT_REVOCABLE_CONSENTS.includes(type),
  };
}

/**
 * Writes the consents captured by an intake form, one row per purpose.
 *
 * Called at patient creation with the boxes the clinic ticked. Only granted consents produce a
 * row: an unticked box is the absence of consent, and writing a row that records "they did not
 * agree" would put a negative in a log whose entire purpose is to evidence positives.
 *
 * Never throws, and its failure never fails the caller. A patient whose record exists without its
 * consent rows is a gap in an audit trail that can be repaired; a clinic unable to enter a patient
 * because the audit collection is unavailable is a clinic that cannot work. The failure is logged
 * loudly for exactly that reason — it is not nothing, it is just not worth a 500 to the clinic.
 */
export async function recordIntakeConsentsService(
  patientId: string,
  clinicId: string,
  granted: ConsentType[],
  ipAddress: string
): Promise<number> {
  if (granted.length === 0) return 0;

  try {
    const grantedAt = clock.now();
    return await consentRecordRepository.createMany(
      granted.map(consentType => ({
        patientId: new mongoose.Types.ObjectId(patientId),
        clinicId: new mongoose.Types.ObjectId(clinicId),
        consentType,
        source: 'clinic_intake' as ConsentSource,
        grantedAt,
        revokedAt: null,
        revokedSource: '',
        consentTextVersion: CONSENT_VERSION,
        ipAddress,
        note: '',
      }))
    );
  } catch (caught) {
    console.error('[consent] intake record failed', { patientId }, caught);
    return 0;
  }
}

/**
 * What the portal's consent screen shows: the standing grants, and what may be turned off.
 *
 * Withdrawn rows are deliberately excluded. This screen answers "what is happening to my data
 * right now", and a list mixing live consents with ones the patient revoked last month is a list
 * they have to read carefully to understand — on a page whose whole value is being unambiguous.
 * The full history, withdrawals included, is in the export.
 */
export async function getConsentSettingsService(
  patientId: string
): Promise<ServiceResult<ConsentSettingsView>> {
  const records = await consentRecordRepository.findActiveByPatient(patientId);

  return {
    data: { consents: records.map(toView), currentVersion: CONSENT_VERSION },
    status: 200,
  };
}

/**
 * The patient turning one consent on or off for themselves.
 *
 * Refuses anything outside `PATIENT_REVOCABLE_CONSENTS` with a 403 rather than silently ignoring
 * it. Withdrawing the basis for holding a clinical record is an erasure request weighed against
 * statutory retention, not a switch — see the comment on that constant — and a portal that
 * accepted the toggle and did nothing would be the worst of both answers.
 *
 * Re-granting writes a fresh row against the wording currently in force rather than clearing the
 * old `revokedAt`. The gap is a fact: a clinic asked whether this patient consented in March has
 * to be able to see that they did not.
 */
export async function changePatientConsentService(
  patientId: string,
  clinicId: string,
  type: ConsentType,
  granted: boolean,
  ipAddress: string
): Promise<ServiceResult<ConsentChangeResult>> {
  if (!PATIENT_REVOCABLE_CONSENTS.includes(type)) {
    return { data: { error: 'CONSENT_NOT_REVOCABLE' }, status: 403 };
  }

  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();

  if (granted) {
    await consentRecordRepository.create({
      patientId: new mongoose.Types.ObjectId(patientId),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      consentType: type,
      source: 'patient_portal',
      grantedAt: now,
      revokedAt: null,
      revokedSource: '',
      consentTextVersion: CONSENT_VERSION,
      ipAddress,
      note: '',
    });
  } else {
    await consentRecordRepository.revoke(patientId, type, now, 'patient_portal', '');
  }

  await applyConsentFlag(patientId, clinicId, type, granted, now);

  return { data: { type, granted }, status: 200 };
}

/**
 * A clinic recording a withdrawal the patient made in person or by phone.
 *
 * The Law on Patient Rights does not require a withdrawal to arrive through any particular
 * channel, so refusing to honour one because it was not typed into the portal by the patient
 * themselves would be the platform inventing a condition the statute does not impose. `note` is
 * where the clinic says how it arrived, and `source: 'staff_request'` keeps that visibly weaker
 * evidence than the patient acting for themselves.
 */
export async function revokeConsentForPatientService(
  patientId: string,
  clinicId: string,
  type: ConsentType,
  note: string
): Promise<ServiceResult<ConsentChangeResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();
  await consentRecordRepository.revoke(patientId, type, now, 'staff_request', note);
  await applyConsentFlag(patientId, clinicId, type, false, now);

  return { data: { type, granted: false }, status: 200 };
}

/**
 * Mirrors a consent decision onto the patient record the hot paths read.
 *
 * Only the two consents that gate something at runtime have a flag. Adding one for `personalData`
 * would be a field nothing reads, and a denormalised copy with no reader is a copy that drifts.
 */
async function applyConsentFlag(
  patientId: string,
  clinicId: string,
  type: ConsentType,
  granted: boolean,
  now: Date
): Promise<void> {
  const at = granted ? null : now;

  if (type === 'notifications') {
    await patientRepository.updateById(patientId, clinicId, { notificationsRevokedAt: at });
    return;
  }

  if (type === 'portalAccess') {
    await patientRepository.updateById(patientId, clinicId, { portalAccessRevokedAt: at });
  }
}
