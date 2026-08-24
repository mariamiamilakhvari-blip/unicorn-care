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
 * Pain and swelling are required; mood is not. Two answers is a usable data point, and a form
 * that demands more is a form fewer people finish — which costs more signal than the extra
 * optional fields would have added.
 *
 * A free-text note and photograph attachments used to ride along here and no longer do. The
 * stored entry still carries both columns so historical entries keep rendering for the clinic,
 * but nothing new arrives through this path, so neither is accepted from the client.
 *
 * `dayIndex` is absent on purpose. It is computed server-side from the plan's start date, because
 * it is the chart's x-axis and a client-supplied value would let a patient file a point on any
 * day of their recovery, including days that have not happened.
 */
export const CreateRecoveryLogSchema = z.object({
  painLevel: z.coerce.number().int().min(PAIN_SCALE_MIN).max(PAIN_SCALE_MAX),
  swelling: z.enum(SWELLING_LEVELS),
  mood: z.enum(MOOD_LEVELS).nullish(),
});

export type CreateRecoveryLogType = z.infer<typeof CreateRecoveryLogSchema>;
