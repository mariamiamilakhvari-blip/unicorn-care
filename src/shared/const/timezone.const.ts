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

/**
 * The zone a patient's own times are in: theirs when it is known and usable, the clinic's until
 * then, and the default only if the clinic's own value is unusable too.
 *
 * A patient's zone is empty until they first open the portal, and recovery starts at the clinic —
 * so inheriting is the correct answer for a new patient, not a stopgap. Each candidate is
 * revalidated rather than trusted: a bad zone written before either field was checked throws
 * inside `Intl` at format time, which is a 500 on the page a patient reads every morning.
 *
 * Pure, and deliberately in `const/` rather than in either feature: the portal read, the reminder
 * generator and the email builders all need the same answer, and putting it in one of them would
 * make the other two import a service they otherwise have no business knowing about.
 */
export function effectiveTimeZone(patientZone: string, clinicZone: string): string {
  if (isValidTimeZone(patientZone)) return patientZone;
  if (isValidTimeZone(clinicZone)) return clinicZone;
  return DEFAULT_TIMEZONE;
}
