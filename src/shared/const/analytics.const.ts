/**
 * The assumption behind "staff hours saved".
 *
 * Nothing in this system observes a phone call that did not happen. There is no measurement here
 * and there cannot be one: the figure is an assumption multiplied by a count, and it is presented
 * as an estimate wherever it appears, with the assumption stated next to it.
 *
 * Two minutes per delivered reminder is the low end of what a receptionist spends placing one
 * call — find the number, dial, wait, explain, log it — and deliberately conservative. A quarterly
 * report that overstates its own value is worth less than one that understates it, because the
 * first is checkable against the clinic's own experience and loses every other number with it.
 *
 * Only *delivered* reminders count toward it. A reminder nobody received saved nobody anything.
 */
export const MINUTES_SAVED_PER_DELIVERED_REMINDER = 2;

/**
 * Onboarding a patient onto the platform replaces the call that would have walked them through
 * their post-operative schedule. Counted once per patient added in the window, not per reminder.
 */
export const MINUTES_SAVED_PER_PATIENT_ONBOARDED = 15;

/** Quarters as month ranges, 1-indexed. Q1 is January to March. */
export const QUARTER_MONTHS: Record<number, { startMonth: number; endMonth: number }> = {
  1: { startMonth: 0, endMonth: 2 },
  2: { startMonth: 3, endMonth: 5 },
  3: { startMonth: 6, endMonth: 8 },
  4: { startMonth: 9, endMonth: 11 },
};

export const QUARTERS = [1, 2, 3, 4] as const;
