import { z } from 'zod';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

/**
 * The Mongoose `Procedure.anesthesia` enum (PRD 01 §5). The `ANESTHESIA_TYPES` catalogue also
 * carries a `regional` label, which the persisted enum does not accept — the schema wins.
 */
export const ANESTHESIA_VALUES = ['none', 'local', 'sedation', 'general'] as const;

const MANIPULATION_TYPE_KEYS: readonly string[] = PROCEDURE_TYPES.map(type => type.key);

const ObjectIdSchema = z.string().min(24).max(24);

/** Accepts any `Date.parse`-able value, including `datetime-local` inputs that carry no zone. */
const DateStringSchema = z
  .string()
  .min(1)
  .refine(value => !Number.isNaN(Date.parse(value)), { message: 'INVALID_DATE' });

/** `clinicId` is deliberately absent — it always comes from `clinicGuard`, never from the body. */
export const CreateProcedureSchema = z.object({
  patientId: ObjectIdSchema,
  performedAt: DateStringSchema,
  operatorName: z.string().min(2).max(120),
  operatorUserId: ObjectIdSchema.nullish(),
  manipulationType: z
    .string()
    .refine(value => MANIPULATION_TYPE_KEYS.includes(value), {
      message: 'INVALID_MANIPULATION_TYPE',
    }),
  manipulationDetail: z.string().max(300).optional(),
  anesthesia: z.enum(ANESTHESIA_VALUES),
  notes: z.string().max(2000).optional(),
  /*
    Same bounds as a dose's lead time: never negative, never more than a day.

    `.optional()` rather than `.default(0)`, matching `notes` and `manipulationDetail` above. A
    default makes the schema's input and output types diverge, and this schema is the form's
    resolver — the form would then be typed against the parsed shape while holding the raw one.
    The service supplies the 0.
  */
  remindMinutesBefore: z.number().int().min(0).max(1440).optional(),
});

/** A procedure never moves between patients, so `patientId` is not patchable. */
export const UpdateProcedureSchema = CreateProcedureSchema.omit({ patientId: true }).partial();

export type CreateProcedureType = z.infer<typeof CreateProcedureSchema>;
export type UpdateProcedureType = z.infer<typeof UpdateProcedureSchema>;
export type AnesthesiaValue = (typeof ANESTHESIA_VALUES)[number];
