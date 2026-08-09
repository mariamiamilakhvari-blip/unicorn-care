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

/**
 * The wording a patient agrees to when attaching a photograph, recorded per upload.
 *
 * Versioned because consent is only meaningful against the text that was shown. Bump this
 * whenever `recoveryLog.photoConsent` changes in the message files, or the stored record starts
 * claiming agreement to wording nobody saw.
 */
export const PHOTO_CONSENT_VERSION = '2026-08-09';

/** Photographs of a healing surgical site. Kept small enough to upload on clinic wifi. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Allowlist, not a blocklist. Anything the browser might execute — SVG above all — is a stored
 * cross-site-scripting payload wearing an image's extension, and a photograph is never one.
 */
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

export const MAX_PHOTOS_PER_LOG = 3;
