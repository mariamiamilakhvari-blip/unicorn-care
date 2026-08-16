/**
 * The consents a patient's record can carry, and what each one authorises.
 *
 * Named after the processing they permit rather than after the checkbox that captured them,
 * because the same consent can be given at intake by a clinic holding a signed form and withdrawn
 * by the patient in the portal a month later. What has to stay stable across those two moments is
 * the *purpose*, which is what the Law of Georgia on Personal Data Protection asks a controller to
 * record and what a patient exercising withdrawal is choosing between.
 *
 * `healthData` is separate from `personalData` and always will be. Health data is special-category
 * data under the Law on Personal Data Protection: it needs its own explicit basis, and folding it
 * into the general one would leave the record unable to show that the stronger consent was ever
 * taken. It is not a more emphatic version of `personalData`.
 *
 * `notifications` is the one the dispatcher reads. Withdrawing it stops every automated message
 * the platform sends — reminders, the daily summary, the portal link — without touching the
 * clinical record behind them, which is the separation the law requires: a patient who no longer
 * wants messages has not asked to be untreated.
 */
export const CONSENT_TYPES = [
  'personalData',
  'healthData',
  'notifications',
  'portalAccess',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Where an acceptance came from.
 *
 * Recorded because the three are not equally strong evidence and a regulator asking "how was this
 * consent obtained" is asking exactly this. `clinic_intake` is a clinic attesting it holds a
 * signed form the platform never saw; `patient_portal` is the patient acting for themselves;
 * `staff_request` is a clinic relaying a withdrawal the patient made by phone or in person, which
 * the Law on Patient Rights requires be honoured however it arrives.
 */
export const CONSENT_SOURCES = ['clinic_intake', 'patient_portal', 'staff_request'] as const;

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/**
 * The consents a patient may withdraw for themselves in the portal.
 *
 * `personalData` and `healthData` are absent on purpose, and their absence is not a limit on the
 * patient's rights — it is where the right is exercised. Withdrawing the basis for holding a
 * clinical record is an erasure request under the Law on Personal Data Protection, which has to
 * be weighed against the retention the Law on Health Care mandates. That is a decision with a
 * legal answer, not a toggle: the portal routes it to `ErasureRequest` instead, where the clinic
 * can act on it and the refusal, if any, is recorded with its reason.
 */
export const PATIENT_REVOCABLE_CONSENTS: readonly ConsentType[] = ['notifications', 'portalAccess'];

/**
 * Which intake checkboxes are consents to *processing*, and which purpose each one authorises.
 *
 * The intake form carries more boxes than this map has keys, and the difference matters. A clinic
 * confirming the record is accurate, or that it told the patient what the platform does, is
 * attesting to something — useful, and stored on the patient record as one dated attestation. It
 * is not a legal basis for processing anything, and writing it into the consent log beside the
 * ones that are would leave that log unable to answer the only question it exists to answer.
 *
 * `reminders` maps to `notifications` rather than being renamed on the form: the checkbox wording
 * is what the clinic and patient read, the consent type is what the dispatcher enforces, and the
 * two are allowed to use different words for the same thing.
 */
export const INTAKE_CONSENT_MAP: Record<string, ConsentType> = {
  personalData: 'personalData',
  healthData: 'healthData',
  reminders: 'notifications',
  portalAccess: 'portalAccess',
};
