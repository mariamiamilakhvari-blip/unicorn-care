/** Delivery outcomes the provider reports and this system records. */
export const EMAIL_EVENT_KINDS = ['delivered', 'bounced', 'complained'] as const;
export type EmailEventKind = (typeof EMAIL_EVENT_KINDS)[number];

/**
 * Why an address stopped being sent to.
 *
 * `''` is the normal state. The reason is kept apart from the fact of suppression because the
 * clinic sees it and the three mean different things to them: a hard bounce is a typo to fix, a
 * complaint is a patient who asked to be left alone, and a soft-bounce threshold is a mailbox
 * that has been full for a week.
 */
export const SUPPRESSION_REASONS = ['', 'hard_bounce', 'complaint', 'soft_bounce'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/**
 * How many soft bounces before an address is suppressed.
 *
 * A soft bounce is temporary by definition — a full mailbox, a server having a bad afternoon — so
 * one must not stop the reminders. But an address that soft-bounces five times running is not
 * recovering, and continuing to send to it damages the sending domain exactly as a hard bounce
 * does. Reset to zero by any successful delivery, so the count measures a run and not a lifetime.
 */
export const SOFT_BOUNCE_LIMIT = 5;

/**
 * Bounce classifications Resend reports as permanent.
 *
 * Anything not in this list is treated as soft — the conservative direction. Suppressing a
 * recoverable address stops a patient's reminders over a transient fault, which is worse than
 * retrying an address that turns out to be dead: the second costs reputation slowly and is caught
 * by the soft-bounce threshold anyway.
 */
export const HARD_BOUNCE_TYPES = ['Permanent', 'hard'];
