import { z } from 'zod';

import { DEFAULT_TIMEZONE, isValidTimeZone } from '@/shared/const/timezone.const';
import { requiresBaa } from '@/shared/utils/baa';
import { requiredConsent } from '@/shared/utils/consent';
import { normaliseTaxId, taxIdIssue } from '@/shared/utils/tax-id';

/**
 * Clinic profile fields (PRD 01 §2). `slug`, `ownerId`, `logoUrl` and `isActive` are derived
 * server-side and are deliberately absent from every request body.
 *
 * Unrefined on purpose. The tax ID rule reads two fields at once, so it can only be attached at
 * object level — and Zod refuses `.partial()` on an object that carries refinements, which is
 * exactly what `UpdateClinicSchema` needs. So the base stays plain and every schema built from it
 * puts the rule back with `withTaxIdRule`.
 */
const ClinicProfileBase = z.object({
  name: z.string().min(2).max(120),
  country: z.string().max(80).default(''),
  city: z.string().max(80).default(''),
  addressLine: z.string().max(200).default(''),
  phone: z.string().max(40).default(''),
  /*
    The clinic's contact address, not the owner's login. Optional — a clinic must be able to save
    the rest of this form without one — so the empty string has to pass, which `z.email()` alone
    would reject. Trimmed first: a pasted address with a trailing space is a valid address.
  */
  email: z
    .string()
    .trim()
    .max(120)
    .refine(value => value === '' || z.string().email().safeParse(value).success, {
      message: 'INVALID_EMAIL',
    })
    .default(''),
  /*
    Sanitised, not merely trimmed: spaces and hyphens are how a registration number is *printed*,
    so they are stripped before anything looks at it. The shape rule itself is country-dependent
    and lives in `withTaxIdRule` below — it needs `country`, which a field-level check cannot see.

    The raw cap is generous because it applies before stripping; every country branch imposes its
    own real bound afterwards.
  */
  taxId: z.string().max(80).transform(normaliseTaxId).default(''),
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

/** The two fields the rule reads. Both optional so a partial (PATCH) body satisfies it too. */
type TaxIdAware = { taxId?: string; country?: string };

/**
 * Attaches the country-aware tax ID rule to any schema that carries `taxId` and `country`.
 *
 * Applied per schema rather than once on the base because Zod drops — or refuses — refinements
 * when an object is reshaped, and because the sign-up form flattens the clinic fields alongside
 * the owner's. Both field names survive that flattening, so one helper covers every case.
 *
 * The issue is raised at `path: ['taxId']` so `react-hook-form` puts the message under the input
 * rather than at the top of the form. On a PATCH that sends `taxId` without `country`, the
 * country resolves to nothing and the generic 5–15 rule applies — the settings form always sends
 * both, so this only affects a hand-made request.
 */
export function withTaxIdRule<Schema extends z.ZodType<TaxIdAware>>(schema: Schema): Schema {
  return schema.superRefine((value, ctx) => {
    const issue = taxIdIssue(value.taxId ?? '', value.country ?? '');
    if (issue) ctx.addIssue({ code: 'custom', message: issue, path: ['taxId'] });
  }) as Schema;
}

export const ClinicProfileSchema = withTaxIdRule(ClinicProfileBase);

export type ClinicProfileType = z.infer<typeof ClinicProfileSchema>;

/** Pre-validation shape: the `.default()` calls make fields optional going in, required coming out. */
export type ClinicProfileFormType = z.input<typeof ClinicProfileSchema>;

/**
 * The consents a clinic gives when it registers.
 *
 * Deliberately *not* part of `ClinicProfileSchema`. `UpdateClinicSchema` is that schema made
 * partial, so folding consents in would let the settings form re-submit them — or worse, let a
 * PATCH silently overwrite a recorded acceptance. Consent is captured once, at registration.
 *
 * The keys are the source of truth for both the schema and the rendered list: `CLINIC_CONSENT_KEYS`
 * is derived from this shape below, so a consent cannot exist in one and not the other.
 */
export const ClinicConsentSchema = z.object({
  terms: requiredConsent(),
  privacy: requiredConsent(),
  patientConsents: requiredConsent(),
  accuracy: requiredConsent(),
  credentials: requiredConsent(),
  processingPurpose: requiredConsent(),
  remindersNotMedicalAdvice: requiredConsent(),
  regulatoryCompliance: requiredConsent(),
  /*
    The HIPAA Business Associate Agreement. The one consent here that is not `requiredConsent()`,
    because whether it is required depends on the clinic's country: HIPAA binds US Covered
    Entities, and a clinic elsewhere is not a party to a BAA. `withBaaRule` enforces it for US
    clinics; everywhere else it is offered, and whatever the clinic chose is recorded.

    Defaulted rather than optional so a body that omits it records a deliberate `false` instead of
    an absence the storage layer has to interpret.
  */
  baa: z.boolean().default(false),
});

export type ClinicConsentType = z.infer<typeof ClinicConsentSchema>;

/** Render order for the checklist. Derived from the schema so the two can never drift apart. */
export const CLINIC_CONSENT_KEYS = Object.keys(
  ClinicConsentSchema.shape
) as (keyof ClinicConsentType)[];

/** The two fields the BAA rule reads, in the shape the flat schemas carry them. */
type BaaAware = { country?: string; consents?: { baa?: boolean } };

/**
 * Makes the Business Associate Agreement mandatory for clinics in the United States.
 *
 * Country-conditional for the same reason the tax ID rule is: this field means different things
 * in different places. HIPAA reaches US Covered Entities, so a US clinic cannot register without
 * a BAA on file, while a clinic elsewhere is offered the box and blocked by nothing.
 *
 * Raised at `path: ['consents', 'baa']` so the message lands under the checkbox rather than at
 * the top of the form, and with its own code so the UI can explain *why* it is required here and
 * not on the eight consents beside it.
 */
export function withBaaRule<Schema extends z.ZodType<BaaAware>>(schema: Schema): Schema {
  return schema.superRefine((value, ctx) => {
    if (!requiresBaa(value.country ?? '')) return;
    if (value.consents?.baa === true) return;

    ctx.addIssue({ code: 'custom', message: 'BAA_REQUIRED', path: ['consents', 'baa'] });
  }) as Schema;
}

export const ClinicOwnerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type ClinicOwnerType = z.infer<typeof ClinicOwnerSchema>;

/**
 * `POST /api/clinic/register` — creates the owner `User` and the `Clinic` in one call.
 *
 * The BAA rule is spelled out rather than reusing `withBaaRule`: this is the one body where the
 * country sits under `clinic` instead of at the top, so the helper's shape does not fit. The rule
 * itself is the same one — `requiresBaa` is the single source of the answer.
 */
export const RegisterClinicSchema = z
  .object({
    owner: ClinicOwnerSchema,
    clinic: ClinicProfileSchema,
    consents: ClinicConsentSchema,
  })
  .superRefine((value, ctx) => {
    if (!requiresBaa(value.clinic?.country ?? '')) return;
    if (value.consents?.baa === true) return;

    ctx.addIssue({ code: 'custom', message: 'BAA_REQUIRED', path: ['consents', 'baa'] });
  });

/**
 * `POST /api/clinic` — the repair path, attaching a clinic to an account that already exists.
 * It creates a clinic just as registration does, so it collects the same consents; the profile
 * schema alone would let that route in without them.
 */
export const CreateClinicForUserSchema = withBaaRule(
  withTaxIdRule(ClinicProfileBase.extend({ consents: ClinicConsentSchema }))
);

export type CreateClinicForUserType = z.infer<typeof CreateClinicForUserSchema>;

export type RegisterClinicType = z.infer<typeof RegisterClinicSchema>;

/** `PATCH /api/clinic` — any subset of the profile fields, tax ID still checked against country. */
export const UpdateClinicSchema = withTaxIdRule(ClinicProfileBase.partial());

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
