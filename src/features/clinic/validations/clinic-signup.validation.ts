import { z } from 'zod';

import {
  ClinicConsentSchema,
  ClinicOwnerSchema,
  ClinicProfileSchema,
} from '@/features/clinic/validations/clinic.validation';

/**
 * The registration form is flat because that is what `react-hook-form` binds to comfortably; the
 * hook reshapes it into the nested `{ owner, clinic }` body the API expects. Both halves reuse the
 * canonical schemas, so a field can never drift between form and endpoint.
 */
export const ClinicSignUpSchema = ClinicOwnerSchema.extend({
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
});

export type ClinicSignUpType = z.infer<typeof ClinicSignUpSchema>;
export type ClinicSignUpFormType = z.input<typeof ClinicSignUpSchema>;

/** The repair path: the account exists already, so only the clinic half is collected. */
export const ClinicOnlySchema = ClinicProfileSchema.extend({ consents: ClinicConsentSchema });
export type ClinicOnlyType = z.infer<typeof ClinicOnlySchema>;
export type ClinicOnlyFormType = z.input<typeof ClinicOnlySchema>;
