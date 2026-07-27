import { z } from 'zod';

/**
 * Shape produced by `PushSubscription.toJSON()` in the browser (PRD 04 §"Client flow" step 4).
 * `endpoint` is the unique key on the row, so re-subscribing upserts rather than duplicating.
 */
export const PushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export type PushSubscribeType = z.infer<typeof PushSubscribeSchema>;

export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export type PushUnsubscribeType = z.infer<typeof PushUnsubscribeSchema>;
