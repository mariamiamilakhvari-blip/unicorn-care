import { z } from 'zod';

import { isValidTimeZone } from '@/shared/const/timezone.const';
import { requiredConsent } from '@/shared/utils/consent';

/**
 * Where the patient is recovering, as the clinic knows it at intake.
 *
 * Empty is a real answer and the default one: it means "wherever the clinic is", which is where
 * recovery starts. `effectiveTimeZone` resolves the blank at read time, so a clinic that later
 * corrects its own zone carries its inheriting patients with it rather than stranding them on a
 * value copied once.
 *
 * Checked against `Intl` rather than against the picker's list. The list is a convenience, the
 * IANA database is the rule, and a zone `Intl` cannot resolve throws at format time — inside the
 * generator, the portal read and every email at once.
 */
const PatientTimeZoneField = z
  .string()
  .max(64)
  .refine(value => value === '' || isValidTimeZone(value), { message: 'INVALID_TIMEZONE' })
  .default('');

/**
 * `dateOfBirth` arrives as an ISO string over JSON, or explicitly as `null`. The `null` branch
 * is listed first so a literal null is never coerced into the epoch by `z.coerce.date()`.
 */
const DateOfBirthSchema = z.union([z.null(), z.coerce.date()]).default(null);

/**
 * Patient fields (PRD 01 §3). `clinicId` is deliberately absent — it is always taken from the
 * session via `clinicGuard`, never from the request body (PRD 02 §"Tenancy guard").
 * There is no archive flag: `DELETE /api/patients/[id]` erases the record outright.
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
  timezone: PatientTimeZoneField,
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
 * The timezone card's own form: one field, the same rule the full patient schema applies to it.
 *
 * Separate from `UpdatePatientSchema` because that one is a partial of every patient field, and a
 * resolver built on it would let the card submit a payload it has no business carrying.
 */
export const PatientTimezoneEditSchema = z.object({
  timezone: PatientTimeZoneField,
});

export type PatientTimezoneEditType = z.infer<typeof PatientTimezoneEditSchema>;

/** The pre-validation half, for the same reason `CreatePatientFormType` exists: `.default('')`. */
export type PatientTimezoneEditFormType = z.input<typeof PatientTimezoneEditSchema>;

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
