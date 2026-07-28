/**
 * Subscription lifecycle, kept out of the schema file so client components can import it without
 * dragging Mongoose into the browser bundle.
 *
 * - `trialing`  — inside the free 7 days
 * - `active`    — paid and current
 * - `past_due`  — payment failed; access is reduced, data is untouched
 * - `expired`   — trial ended with no upgrade
 * - `cancelled` — deliberately ended by the clinic
 */
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'expired',
  'cancelled',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that still permit creating new clinical records. */
export const WRITE_ALLOWED_STATUSES: SubscriptionStatus[] = ['trialing', 'active'];
