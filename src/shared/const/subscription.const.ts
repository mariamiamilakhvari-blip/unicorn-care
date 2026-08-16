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

/**
 * How long reminders keep going after a subscription lapses.
 *
 * Writing stops the instant the subscription does — no new patients, no new care plans. Sending
 * does not, and the two are deliberately different lengths. A patient discharged the day before a
 * trial ran out is inside the window where a missed antibiotic dose is a readmission, and the
 * clinic's billing state is not a fact about that patient's recovery. Fourteen days covers the
 * critical immediate recovery window without funding a six-month rehabilitation plan for free:
 * long enough that nobody is dropped mid-course, short enough that the plan has to be paid for.
 *
 * The ceiling is what makes it a grace period rather than a loophole. Running reminders to the end
 * of the care plan would mean a clinic could activate a year of daily messaging on day six of a
 * free trial and never pay for any of it.
 */
export const DISPATCH_GRACE_DAYS = 14;

/**
 * The day of the grace period the warning starts on — four days before reminders stop.
 *
 * Four days rather than one: restoring access means an owner finding a card and a finance approval
 * in some practices, and a warning that arrives the morning of the cutoff is an announcement, not
 * a chance to act.
 */
export const GRACE_WARNING_AFTER_DAYS = 10;
