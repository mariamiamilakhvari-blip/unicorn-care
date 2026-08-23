import { z } from 'zod';

import { requiredConsent } from '@/shared/utils/consent';

/**
 * `dateOfBirth` arrives as an ISO string over JSON, or explicitly as `null`. The `null` branch
 * is listed first so a literal null is never coerced into the epoch by `z.coerce.date()`.
 */
const DateOfBirthSchema = z.union([z.null(), z.coerce.date()]).default(null);

/**
 * Patient fields (PRD 01 §3). `clinicId` is deliberately absent — it is always taken from the
 * session via `clinicGuard`, never from the request body (PRD 02 §"Tenancy guard").
 * There is no archive flag: `DELETE /api/patients/[id]` erases the record outright.
 *
 * `timezone` is absent for the same reason `clinicId` is: it is not the clinic's to state. A new
 * patient is given the clinic's own zone by `createPatientService`, and from then on the only
 * thing that changes it is the patient's device reporting where they actually are — see
 * `syncPatientTimezoneService`. Accepting it here would put a hand-typed zone in front of a
 * measured one, and being wrong about it moves every reminder in the plan by hours.
 */
/**
 * What the clinic attests to when it enters a patient.
 *
 * These are not the patient's own consents — the patient is not at the keyboard. They are the
 * clinic confirming it already holds that consent offline, which is the only honest model here:
 * under the Law of Georgia on Personal Data Protection health data is special-category data
 * requiring explicit consent, and the platform never speaks to the patient before the record
 * exists. `healthData` is listed separately from `personalData` for that reason; special-category
 * data is a distinct legal basis, not a stronger version of one.
 *
 * Four of these are consents to processing and are written to the `ConsentRecord` audit trail with
 * their own timestamp, wording version and source — see `INTAKE_CONSENT_MAP`, which is the
 * authority on which. The remaining three are attestations about the record rather than bases for
 * touching it, and are stored as one dated confirmation on the patient instead.
 */
export const PatientConsentSchema = z.object({
  personalData: requiredConsent(),
  healthData: requiredConsent(),
  reminders: requiredConsent(),
  portalAccess: requiredConsent(),
  informed: requiredConsent(),
  accurate: requiredConsent(),
  corrections: requiredConsent(),
});

export type PatientConsentType = z.infer<typeof PatientConsentSchema>;

/** Render order for the checklist. Derived from the schema so the two can never drift apart. */
export const PATIENT_CONSENT_KEYS = Object.keys(
  PatientConsentSchema.shape
) as (keyof PatientConsentType)[];

export const CreatePatientSchema = z.object({
  /*
    Trimmed on the way in, which is not cosmetic. An untrimmed `"tamar "` makes the full name
    `"tamar  amilakhvari"` — a doubled space the browser renders as one, so the erasure dialog asks
    for a name that cannot be typed back. `normalizeConfirmationName` forgives the records that
    already carry it; this stops new ones being written.
  */
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().max(40).default(''),
  email: z.union([z.literal(''), z.string().email()]).default(''),
  dateOfBirth: DateOfBirthSchema,
  sex: z.enum(['female', 'male', 'other', 'unspecified']).default('unspecified'),
  locale: z.enum(['ka', 'en']).default('ka'),
  allergies: z.array(z.string().min(1).max(120)).max(50).default([]),
  notes: z.string().max(2000).default(''),
  consents: PatientConsentSchema,
});

export type CreatePatientType = z.infer<typeof CreatePatientSchema>;

/**
 * What the form holds *before* validation. The `.default()` calls above make several fields
 * optional on the way in and required on the way out, so react-hook-form needs both sides —
 * `useForm<CreatePatientFormType, undefined, CreatePatientType>`.
 */
export type CreatePatientFormType = z.input<typeof CreatePatientSchema>;

/*
  `consents` is omitted before the partial, not merely made optional by it. Editing a patient is
  not a fresh attestation, and leaving the key accepted here would let a PATCH overwrite the
  record of when the clinic first confirmed consent.
*/
export const UpdatePatientSchema = CreatePatientSchema.omit({ consents: true }).partial();

export type UpdatePatientType = z.infer<typeof UpdatePatientSchema>;

/**
 * The typed confirmation guarding patient erasure — checked against the patient's own name.
 *
 * A confirm dialog alone is a single click, and this destroys a clinical record outright: the
 * plans, the adherence history, the post-operative photographs. Typing the name is the same gate
 * account deletion uses, for the same reason.
 */
export const DeletePatientSchema = z.object({
  confirmationName: z.string().min(1).max(200),
});

export type DeletePatientType = z.infer<typeof DeletePatientSchema>;
