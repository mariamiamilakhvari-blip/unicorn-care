import { z } from 'zod';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import { CONTACT_METHODS, DEFAULT_CONTACT_METHOD } from '@/shared/const/recovery.const';
import { WARNING_SEVERITIES } from '@/shared/const/recovery.const';
import { SYMPTOM_REPORT_STATUSES } from '@/shared/const/recovery.const';

const MANIPULATION_KEYS: readonly string[] = PROCEDURE_TYPES.map(type => type.key);

/**
 * How many days from the operation this item applies for.
 *
 * One number where the editor used to ask for two. A clinic writing "what is normal" is answering
 * "for how long", and the start of the window was almost always day 0 anyway — the second input
 * mostly collected a zero and occasionally collected a mistake.
 *
 * The stored document still holds a `fromDay`/`toDay` pair, and deliberately so: the daily email
 * filters guide items by whether today falls inside the window, the portal prints the range, and
 * expected-sign reminders are scheduled off the start day. `upsertGuideService` maps this number
 * onto `{ fromDay: 0, toDay: durationDays }`, so those readers are untouched and rows written
 * before this change keep the windows they have until somebody edits them.
 */
const DurationDaysSchema = z.number().int().min(0).max(365);

const ExpectedItemSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  durationDays: DurationDaysSchema,
});

const WarningItemSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).default(''),
  severity: z.enum(WARNING_SEVERITIES),
  durationDays: DurationDaysSchema.default(0),
});

/** `clinicId` is never in the body — it comes from `clinicGuard`, like every clinical write. */
export const UpsertRecoveryGuideSchema = z.object({
  manipulationType: z.string().refine(value => MANIPULATION_KEYS.includes(value), {
    message: 'INVALID_MANIPULATION_TYPE',
  }),
  locale: z.enum(['ka', 'en']),
  expected: z.array(ExpectedItemSchema).max(30).default([]),
  warning: z.array(WarningItemSchema).max(30).default([]),
  isPublished: z.boolean().default(true),
});

export type UpsertRecoveryGuideType = z.infer<typeof UpsertRecoveryGuideSchema>;
export type RecoveryGuideFormType = z.input<typeof UpsertRecoveryGuideSchema>;

/**
 * An admin putting a platform default in front of patients, or taking it back out.
 *
 * No `.default()` on the flag, unlike every other `isPublished` in this file. The others describe
 * a clinic saving its own text, where "publish it" is the obvious intent of pressing save. This
 * one is a platform admin deciding that generic drafting is now fit for a post-operative patient
 * to act on, and a request that forgot to say which way it meant should be rejected rather than
 * resolved by a default.
 */
export const PublishDefaultGuideSchema = z.object({
  isPublished: z.boolean(),
});

export type PublishDefaultGuideType = z.infer<typeof PublishDefaultGuideSchema>;

/**
 * What the patient submits. Either they tapped a warning item from the guide, or they typed a
 * note — one of the two must be present, otherwise the clinic gets an empty row to chase.
 */
export const CreateSymptomReportSchema = z
  .object({
    warningTitle: z.string().max(160).default(''),
    severity: z.string().max(40).default(''),
    note: z.string().max(1000).default(''),
    /*
      How to come back to them, and where. Both default rather than being required: the concern
      form is the one thing a worried patient must always be able to send, and a report refused
      because a selector was untouched is a symptom the clinic never hears about.

      `contactPhone` is not format-checked beyond a length cap. A patient abroad may write a number
      in any of a dozen shapes, and the honest thing to do with an odd one is show it to a human —
      see `toWhatsAppNumber`, which declines to build a link rather than build a wrong one.
    */
    contactMethod: z.enum(CONTACT_METHODS).default(DEFAULT_CONTACT_METHOD),
    contactPhone: z.string().trim().max(40).default(''),
  })
  .refine(input => input.warningTitle.trim().length > 0 || input.note.trim().length > 0, {
    message: 'EMPTY_REPORT',
    path: ['note'],
  });

export type CreateSymptomReportType = z.infer<typeof CreateSymptomReportSchema>;

export const ReviewSymptomReportSchema = z.object({
  status: z.enum(SYMPTOM_REPORT_STATUSES),
  clinicNote: z.string().max(1000).default(''),
});

export type ReviewSymptomReportType = z.infer<typeof ReviewSymptomReportSchema>;
