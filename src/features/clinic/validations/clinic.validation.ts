import { z } from 'zod';

import { DEFAULT_TIMEZONE, isValidTimeZone } from '@/shared/const/timezone.const';

/**
 * Alphanumerics separated by single spaces or hyphens, and nothing else.
 *
 * Deliberately not a per-country rule. The same field has to hold a German VAT number
 * (DE123456789), a US EIN (12-3456789), a UK company number (SC123456), and a Georgian tax ID
 * (204567891) — anchoring it to one shape makes the product unusable everywhere else, and a
 * clinic that cannot enter its own real number cannot be invoiced.
 *
 * What it does reject is punctuation that only ever arrives by accident: a stray comma, a pasted
 * newline, a trailing separator. Those are typos, not formats.
 */
const TAX_ID_PATTERN = /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/;

/**
 * Clinic profile fields (PRD 01 §2). `slug`, `ownerId`, `logoUrl` and `isActive` are derived
 * server-side and are deliberately absent from every request body.
 */
export const ClinicProfileSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().max(80).default(''),
  city: z.string().max(80).default(''),
  addressLine: z.string().max(200).default(''),
  phone: z.string().max(40).default(''),
  /*
    Optional, because it is needed to raise an invoice and not to open an account — a required
    field here loses sign-ups from clinics whose registration number is with their accountant.
    Trimmed before the pattern runs so a copy-pasted value with surrounding whitespace passes.
  */
  taxId: z
    .string()
    .trim()
    .max(40)
    .refine(value => value === '' || TAX_ID_PATTERN.test(value), { message: 'INVALID_TAX_ID' })
    .default(''),
  locale: z.enum(['ka', 'en']).default('ka'),
  /*
    Rejected at the boundary rather than trusted. An invalid zone makes `Intl.DateTimeFormat`
    throw deep inside the occurrence generator, which the clinic saw as a 500 when activating a
    plan — with no hint that a settings field was the cause.
  */
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, { message: 'INVALID_TIMEZONE' })
    .default(DEFAULT_TIMEZONE),
});

export type ClinicProfileType = z.infer<typeof ClinicProfileSchema>;

/** Pre-validation shape: the `.default()` calls make fields optional going in, required coming out. */
export type ClinicProfileFormType = z.input<typeof ClinicProfileSchema>;

export const ClinicOwnerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type ClinicOwnerType = z.infer<typeof ClinicOwnerSchema>;

/** `POST /api/clinic/register` — creates the owner `User` and the `Clinic` in one call. */
export const RegisterClinicSchema = z.object({
  owner: ClinicOwnerSchema,
  clinic: ClinicProfileSchema,
});

export type RegisterClinicType = z.infer<typeof RegisterClinicSchema>;

/** `PATCH /api/clinic` — any subset of the profile fields. */
export const UpdateClinicSchema = ClinicProfileSchema.partial();

export type UpdateClinicType = z.infer<typeof UpdateClinicSchema>;

/**
 * `POST /api/clinic/staff` (owner only). No password field: the service generates a temporary
 * one and returns it once — the product has no email channel to send it through.
 */
export const CreateStaffSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  jobTitle: z.string().min(2).max(80),
});

export type CreateStaffType = z.infer<typeof CreateStaffSchema>;

/** The typed confirmation guarding account deletion — checked against the clinic's own name. */
export const DeleteClinicSchema = z.object({
  confirmationName: z.string().min(1).max(200),
});

export type DeleteClinicType = z.infer<typeof DeleteClinicSchema>;
