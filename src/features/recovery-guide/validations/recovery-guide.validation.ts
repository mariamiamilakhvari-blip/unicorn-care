import { z } from 'zod';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import { WARNING_SEVERITIES } from '@/shared/const/recovery.const';
import { SYMPTOM_REPORT_STATUSES } from '@/shared/const/recovery.const';

const MANIPULATION_KEYS: readonly string[] = PROCEDURE_TYPES.map(type => type.key);

const ExpectedItemSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(1000).default(''),
    fromDay: z.number().int().min(0).max(365),
    toDay: z.number().int().min(0).max(365),
  })
  .refine(item => item.toDay >= item.fromDay, {
    message: 'END_DAY_BEFORE_START_DAY',
    path: ['toDay'],
  });

const WarningItemSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(1000).default(''),
    severity: z.enum(WARNING_SEVERITIES),
    fromDay: z.number().int().min(0).max(365).default(0),
    toDay: z.number().int().min(0).max(365).default(0),
  })
  .refine(item => item.toDay >= item.fromDay, {
    message: 'END_DAY_BEFORE_START_DAY',
    path: ['toDay'],
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
 * What the patient submits. Either they tapped a warning item from the guide, or they typed a
 * note — one of the two must be present, otherwise the clinic gets an empty row to chase.
 */
export const CreateSymptomReportSchema = z
  .object({
    warningTitle: z.string().max(160).default(''),
    severity: z.string().max(40).default(''),
    note: z.string().max(1000).default(''),
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
