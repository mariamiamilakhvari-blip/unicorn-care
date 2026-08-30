/**
 * How long each class of data is kept, and which of it survives an erasure request.
 *
 * Two statutes pull in opposite directions here and both have to be obeyed. The Law of Georgia on
 * Personal Data Protection says data is kept only as long as the purpose requires and gives the
 * patient a right to erasure. The Law of Georgia on Health Care, and the Ministry of Health record
 * -keeping rules made under it, require a clinical record to be retained for a fixed period
 * regardless of what the patient would prefer — a doctor cannot be asked to prove the care they
 * gave from a record the patient had deleted.
 *
 * The resolution is not a compromise on either: identifying and contact data is erasable on
 * request, the clinical log is retained but severed from the identifiers that make it personal
 * data in the first place. `ERASABLE_PATIENT_FIELDS` is that line, written once here so the
 * erasure service and anything auditing it cannot disagree about where it falls.
 *
 * The periods below are the platform's configured defaults, not legal advice, and a clinic
 * operating under a longer sectoral rule should raise them. They are expressed in years because
 * that is the unit the rules are written in.
 */

/**
 * Clinical records — care plans, reminder occurrences, recovery logs, symptom reports.
 *
 * The long one, and the reason erasure cannot simply delete a patient. Nothing in the automated
 * archival routines may drop a row inside this window: see `isWithinClinicalRetention`.
 */
export const CLINICAL_RECORD_RETENTION_YEARS = 15;

/**
 * Consent records.
 *
 * Kept at least as long as the processing they authorised, because a consent that has expired out
 * of the log cannot demonstrate the lawfulness of anything done while it stood. Deliberately equal
 * to the clinical period rather than shorter — the evidence and the thing it justifies retire
 * together.
 */
export const CONSENT_RECORD_RETENTION_YEARS = CLINICAL_RECORD_RETENTION_YEARS;

/**
 * Delivery telemetry — email bounce events, dispatch outcomes.
 *
 * Operational data, not clinical: it answers "did the message arrive", which stops being a live
 * question quickly. Short by design, because data minimisation applies to logs too.
 */
export const DELIVERY_LOG_RETENTION_YEARS = 2;

/**
 * The patient fields an erasure request clears.
 *
 * Everything here identifies or contacts a person and none of it is clinically load-bearing: a
 * medication history is as valid without a phone number attached. What is deliberately *not* here
 * is anything the clinical record needs to stay coherent — `age` and `sex` stay, because a
 * dose is only interpretable against them, and `allergies` stays because deleting it could get
 * someone hurt.
 *
 * Clearing these is what makes the retained log stop being personal data in practice while the
 * statutory retention on it runs.
 */
export const ERASABLE_PATIENT_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'notes',
] as const;

export type ErasablePatientField = (typeof ERASABLE_PATIENT_FIELDS)[number];

/**
 * What an erased name is replaced with, so the record still renders and still sorts.
 *
 * Locale-neutral on purpose. A clinic list mixes Georgian and English records, and a placeholder
 * in one language reads as a real name in the other — which is the one thing this value must never
 * do, because a clinic scanning a caseload has to be able to see at a glance that this record was
 * erased rather than badly entered.
 */
export const ERASED_PLACEHOLDER = '[ERASED]';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * True while a clinical record is still inside its mandatory retention window.
 *
 * The guard every deletion path has to pass. Expressed as a question about a date rather than as a
 * cut-off constant so callers cannot accidentally compare against the wrong epoch, and using the
 * mean Julian year so leap years do not shorten the window.
 */
export function isWithinClinicalRetention(recordedAt: Date, now: Date): boolean {
  const elapsed = now.getTime() - recordedAt.getTime();
  return elapsed < CLINICAL_RECORD_RETENTION_YEARS * MS_PER_YEAR;
}
