import { Types } from 'mongoose';

import { regeneratePlansForTimezoneService } from '@/features/care-plan/service/care-plan.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { checkPatientSeat } from '@/features/clinic/service/subscription.service';
import { recordIntakeConsentsService } from '@/features/data-protection/service/consent.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { PatientListResult, PatientSummary } from '@/features/patient/types/patient.types';
import {
  CreatePatientType,
  UpdatePatientType,
} from '@/features/patient/validations/patient.validation';
import { ConsentType, INTAKE_CONSENT_MAP } from '@/shared/const/consent-type.const';
import { CONSENT_VERSION } from '@/shared/const/consent.const';
import { effectiveTimeZone } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { UNKNOWN_IP } from '@/shared/utils/client-ip';

export const PATIENT_PAGE_SIZE = 20;

function toPatientSummary(patient: PatientDocument): PatientSummary {
  return {
    id: patient._id.toString(),
    firstName: patient.firstName,
    lastName: patient.lastName,
    // Schema defaults these but the inferred types stay nullable — normalise for the wire.
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
    sex: patient.sex,
    locale: patient.locale,
    allergies: patient.allergies ?? [],
    notes: patient.notes ?? '',
    timezone: patient.timezone ?? '',
  };
}

/**
 * The intake boxes that are bases for processing, in the vocabulary the audit trail uses.
 *
 * Driven by `INTAKE_CONSENT_MAP` rather than by a hand-written list so a consent added to the form
 * cannot quietly fail to reach the log — the map is the single place the two vocabularies meet.
 */
function grantedConsentTypes(consents: Record<string, boolean>): ConsentType[] {
  return Object.entries(INTAKE_CONSENT_MAP)
    .filter(([formKey]) => consents[formKey] === true)
    .map(([, consentType]) => consentType);
}

/**
 * `ipAddress` is recorded next to the consents this call captures, as supporting evidence of where
 * the attestation was made from. It defaults rather than being required because the service is
 * callable from contexts that have no request in hand — a seed, a test — and `unknown` is the
 * honest record for those. It is never used to authorise anything: see `clientIp`.
 */
export async function createPatientService(
  clinicId: string,
  input: CreatePatientType,
  ipAddress: string = UNKNOWN_IP
): Promise<ServiceResult<PatientSummary>> {
  /*
    Plan limits are enforced here rather than in the route so every caller is covered, and the
    reason is passed through: "your trial ended" and "you are out of seats" call for different
    responses from the clinic. 402 is the honest status — the request is valid, payment is what
    is missing.
  */
  const seat = await checkPatientSeat(clinicId);
  if (!seat.ok) return { data: { error: seat.reason }, status: 402 };

  /*
    Defence in depth. The route schema already rejects a missing or false consent, but this
    service is callable from anywhere in the codebase, and the consent record written below is
    only honest if every box really was ticked. Cheap to check, and it fails loudly if some
    future caller skips validation.
  */
  const { consents, ...patient } = input;
  if (Object.values(consents).some(given => given !== true)) {
    return { data: { error: 'CONSENT_REQUIRED' }, status: 400 };
  }
  const patientId = await patientRepository.create({
    ...patient,
    clinicId: new Types.ObjectId(clinicId),
    consent: { version: CONSENT_VERSION, confirmedAt: clock.now() },
  });

  /*
    The audit trail the Law of Georgia on Personal Data Protection asks for: one dated row per
    purpose, carrying the wording version and where the attestation came from. The `consent` block
    written above is the summary the clinic sees on the record; this is the evidence behind it, and
    the only one of the two that can answer what was agreed to and when it was withdrawn.

    Awaited but not checked. The service swallows and logs its own failures by design — a clinic
    that cannot enter a patient because the audit collection is unavailable is worse than a gap
    that can be repaired. See `recordIntakeConsentsService`.
  */
  await recordIntakeConsentsService(patientId, clinicId, grantedConsentTypes(consents), ipAddress);

  const created = await patientRepository.findById(patientId, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toPatientSummary(created), status: 201 };
}

/**
 * `query` switches to the clinic-scoped regex search, which the repository returns unpaginated —
 * a clinic's roster is small enough that a single result set is the honest answer here.
 */
export async function listPatientsService(
  clinicId: string,
  page = 1,
  limit = PATIENT_PAGE_SIZE,
  query?: string
): Promise<ServiceResult<PatientListResult>> {
  if (query) {
    const matches = await patientRepository.search(clinicId, query);
    const items = matches.map(toPatientSummary);
    return { data: { items, total: items.length, page: 1, limit: items.length }, status: 200 };
  }

  const { items, total } = await patientRepository.findAllByClinic(clinicId, page, limit);
  return { data: { items: items.map(toPatientSummary), total, page, limit }, status: 200 };
}

/**
 * 404 covers both "no such patient" and "belongs to another clinic". The distinction is
 * deliberately not exposed — it would leak the existence of other clinics' records.
 */
export async function getPatientService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<PatientSummary>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: toPatientSummary(patient), status: 200 };
}

/**
 * A clinic edit, including the one edit that moves a schedule.
 *
 * `timezone` is not an ordinary field. The occurrence rows hold absolute instants resolved from
 * the prescribed wall clock at the moment they were built, so changing the zone on the record and
 * stopping there would leave a patient's reminders firing on the clock of a country they have
 * left — the field would read correctly and nothing the patient can see would change.
 *
 * Compared as *effective* zones, not as stored strings. A clinic clearing the field is setting the
 * patient back to inheriting, which is a real move when the clinic sits in a different zone, and a
 * clinic typing the zone the patient was already inheriting is no move at all.
 */
export async function updatePatientService(
  clinicId: string,
  patientId: string,
  input: UpdatePatientType
): Promise<ServiceResult<PatientSummary>> {
  const before = await patientRepository.findById(patientId, clinicId);
  if (!before) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const updated = await patientRepository.updateById(patientId, clinicId, input);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  if (input.timezone !== undefined) {
    await retimePlansForPatient(clinicId, patientId, before.timezone ?? '', input.timezone);
  }

  return getPatientService(clinicId, patientId);
}

/**
 * Rebuilds the patient's active plans when an edit actually moved them.
 *
 * Failure is logged and swallowed: the record has already been corrected, and a regeneration that
 * threw must not turn a saved edit into a 500 the clinic reads as "nothing was saved". The next
 * portal visit re-reports the device zone and rebuilds anyway, so this is recoverable — silently
 * reverting the clinic's edit would not be.
 */
async function retimePlansForPatient(
  clinicId: string,
  patientId: string,
  storedBefore: string,
  storedAfter: string
): Promise<void> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return;

  const before = effectiveTimeZone(storedBefore, clinic.timezone);
  const after = effectiveTimeZone(storedAfter, clinic.timezone);
  if (before === after) return;

  try {
    const result = await regeneratePlansForTimezoneService(patientId, clinicId, after);
    const rebuilt = 'occurrences' in result.data ? result.data.occurrences : 0;
    console.warn('[patient] timezone changed by clinic', { patientId, before, after, rebuilt });
  } catch (caught) {
    console.error('[patient] could not re-time plans after a timezone edit', patientId, caught);
  }
}
