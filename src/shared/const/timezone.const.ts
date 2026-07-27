/**
 * Clinic timezones.
 *
 * Every prescribed time is wall clock in the clinic's zone, so this value drives the whole
 * reminder generator. It must be a real IANA identifier: `Intl.DateTimeFormat` throws a
 * `RangeError` on anything else, which surfaced as a 500 when activating a plan. A free-text
 * field made that trivially easy to hit — "Tbilisi" looks right and is not a valid zone.
 */

/** Shown in the picker. Any valid IANA name still passes validation. */
export const COMMON_TIMEZONES = [
  'Asia/Tbilisi',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Kyiv',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Asia/Yerevan',
  'Asia/Baku',
  'Asia/Dubai',
  'Asia/Jerusalem',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
] as const;

export const DEFAULT_TIMEZONE = 'Asia/Tbilisi';

/** Cheapest reliable check: ask the platform to build a formatter and see whether it refuses. */
export function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
