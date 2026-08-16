import { z } from 'zod';

import {
  ClinicConsentSchema,
  ClinicOwnerSchema,
  ClinicProfileSchema,
  withTaxIdRule,
} from '@/features/clinic/validations/clinic.validation';

/**
 * The registration form is flat because that is what `react-hook-form` binds to comfortably; the
 * hook reshapes it into the nested `{ owner, clinic }` body the API expects. Both halves reuse the
 * canonical schemas, so a field can never drift between form and endpoint.
 */
/*
  `name` is omitted: the form no longer asks for the owner's personal name, so the hook sends the
  clinic name in its place. The owner record still has one — `ClinicOwnerSchema` is unchanged and
  the API still requires it — it is just no longer a question the clinic has to answer twice.
*/
/*
  Wrapped in the country-aware tax ID rule because it lives on the object, not the field: it
  compares the tax ID against the country, and borrowing `ClinicProfileSchema.shape.taxId` copies
  the field but not the rule — so without this the form would accept what the register endpoint
  then rejects.
*/
export const ClinicSignUpSchema = withTaxIdRule(
  ClinicOwnerSchema.omit({ name: true }).extend({
    clinicName: ClinicProfileSchema.shape.name,
    country: ClinicProfileSchema.shape.country,
    city: ClinicProfileSchema.shape.city,
    addressLine: ClinicProfileSchema.shape.addressLine,
    clinicPhone: ClinicProfileSchema.shape.phone,
    taxId: ClinicProfileSchema.shape.taxId,
    locale: ClinicProfileSchema.shape.locale,
    timezone: ClinicProfileSchema.shape.timezone,
    // Nested rather than flattened like the other clinic fields: these keys are shared verbatim
    // with the onboarding form and the API body, and flattening would fork them into three lists.
    consents: ClinicConsentSchema,
  })
);

export type ClinicSignUpType = z.infer<typeof ClinicSignUpSchema>;
export type ClinicSignUpFormType = z.input<typeof ClinicSignUpSchema>;

/*
  The repair path: the account exists already, so only the clinic half is collected. The tax ID
  rule is not re-applied — `.extend()` carries the profile schema's own across, and wrapping again
  would show the clinic the same error twice.
*/
export const ClinicOnlySchema = ClinicProfileSchema.extend({ consents: ClinicConsentSchema });
export type ClinicOnlyType = z.infer<typeof ClinicOnlySchema>;
export type ClinicOnlyFormType = z.input<typeof ClinicOnlySchema>;
