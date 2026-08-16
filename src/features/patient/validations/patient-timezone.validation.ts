import { z } from 'zod';

/**
 * The zone a patient's own browser reported, straight from
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *
 * Bounded but not enumerated: the IANA database is long and grows, and a patient recovering
 * somewhere this product has never seen before must still be reminded at the right hour. Whether
 * the string is a zone the platform can actually resolve is decided by `isValidTimeZone` in the
 * service — Zod cannot answer that, and a regex that tried would reject real zones.
 */
export const PatientTimezoneSchema = z.object({
  timezone: z.string().min(1).max(64),
});

export type PatientTimezoneType = z.infer<typeof PatientTimezoneSchema>;
