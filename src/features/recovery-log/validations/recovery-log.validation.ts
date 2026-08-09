import { z } from 'zod';

import {
  MOOD_LEVELS,
  PAIN_SCALE_MAX,
  PAIN_SCALE_MIN,
  SWELLING_LEVELS,
} from '@/shared/const/recovery-log.const';

/**
 * What the patient submits from the portal.
 *
 * Pain and swelling are required; mood and note are not. Two answers is a usable data point, and
 * a form that demands four is a form fewer people finish — which costs more signal than the two
 * optional fields would have added.
 *
 * `dayIndex` is absent on purpose. It is computed server-side from the plan's start date, because
 * it is the chart's x-axis and a client-supplied value would let a patient file a point on any
 * day of their recovery, including days that have not happened.
 */
export const CreateRecoveryLogSchema = z.object({
  painLevel: z.coerce.number().int().min(PAIN_SCALE_MIN).max(PAIN_SCALE_MAX),
  swelling: z.enum(SWELLING_LEVELS),
  mood: z.enum(MOOD_LEVELS).nullish(),
  note: z.string().trim().max(2000).default(''),
  /** Ids of photographs already uploaded through the photo endpoint, which captured consent. */
  photoIds: z.array(z.string().min(24).max(24)).max(3).default([]),
});

export type CreateRecoveryLogType = z.infer<typeof CreateRecoveryLogSchema>;

/**
 * The consent a patient gives when attaching a photograph.
 *
 * `true` is the only accepted value — `z.literal(true)` rather than a boolean, so an absent or
 * false field is a validation failure rather than a silently unconsented upload.
 */
export const PhotoConsentSchema = z.object({
  consentGranted: z.literal(true),
});

export type PhotoConsentType = z.infer<typeof PhotoConsentSchema>;
