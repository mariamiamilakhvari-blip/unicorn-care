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
 * `isArchived` is absent too: archiving goes through `DELETE /api/patients/[id]`.
 */
/**
 * What the clinic attests to when it enters a patient.
 *
 * These are not the patient's own consents — the patient is not at the keyboard. They are the
 * clinic confirming it already holds that consent offline, which is the only honest model here:
 * under GDPR Art. 9 health data needs explicit consent, and the platform never speaks to the
 * patient before the record exists. `healthData` is listed separately from `personalData` for
 * that reason; special-category data is a distinct legal basis, not a stronger version of one.
 */
export const PatientConsentSchema = z.object({
  personalData: requiredConsent(),
  healthData: requiredConsent(),
  reminders: requiredConsent(),
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
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
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
