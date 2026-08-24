/**
 * How often a patient is asked how recovery is going (PRD 06 §3).
 *
 * Decreasing, because the useful signal decreases. Week one is where a complication shows up and
 * where a daily answer is worth having; by week six the interesting question is whether the curve
 * is still heading the right way, which a weekly point answers just as well. Asking daily for
 * three months trains people to dismiss the prompt, and a dismissed prompt reports nothing.
 *
 * Bands are half-open on `untilDay`: the first covers days 0–6, the second 7–27, the last
 * everything after.
 */
export const RECOVERY_LOG_CADENCE = [
  { untilDay: 7, everyDays: 1 },
  { untilDay: 28, everyDays: 3 },
  { untilDay: Infinity, everyDays: 7 },
] as const;

/** Clinic-local wall clock for the prompt. Evening: the patient is reporting on the day behind them. */
export const RECOVERY_LOG_PROMPT_TIME = '19:00';

export const SWELLING_LEVELS = ['none', 'mild', 'moderate', 'severe'] as const;

export type SwellingLevel = (typeof SWELLING_LEVELS)[number];

export const MOOD_LEVELS = ['poor', 'ok', 'good'] as const;

export type MoodLevel = (typeof MOOD_LEVELS)[number];

/** 0–10, the scale a patient is asked in every clinic already. */
export const PAIN_SCALE_MIN = 0;
export const PAIN_SCALE_MAX = 10;
