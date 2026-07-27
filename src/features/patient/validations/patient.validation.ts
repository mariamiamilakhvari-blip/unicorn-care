import { z } from 'zod';

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
});

export type CreatePatientType = z.infer<typeof CreatePatientSchema>;

/**
 * What the form holds *before* validation. The `.default()` calls above make several fields
 * optional on the way in and required on the way out, so react-hook-form needs both sides —
 * `useForm<CreatePatientFormType, undefined, CreatePatientType>`.
 */
export type CreatePatientFormType = z.input<typeof CreatePatientSchema>;

export const UpdatePatientSchema = CreatePatientSchema.partial();

export type UpdatePatientType = z.infer<typeof UpdatePatientSchema>;
