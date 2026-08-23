import { OccurrenceCopyKey, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import { AppLocale } from '@/shared/types/roles';

/**
 * Every translatable word that can appear on a reminder occurrence, in both languages.
 *
 * `buildOccurrences` renders `title`/`body` once, at generation time, and stores them on the row —
 * that is what keeps dispatch a pure read. So the locale has to be decided here, when the plan is
 * materialised, and not at send time when there is nothing left to translate.
 *
 * Both tables are small enough to share a file, unlike `emailCopy`, whose two locales are split
 * across files to stay under the length limit.
 */
export const OCCURRENCE_EN_COPY: Record<OccurrenceCopyKey, string> = {
  withFood: 'Take with food.',
  withoutFood: 'Take on an empty stomach.',
  today: 'Today',
  tomorrow: 'Tomorrow',
  startingSoon: 'Starts',
  expectedSign: 'This is expected',
  recoveryCheckIn: 'How is your recovery going?',
};

/*
  Lifted from the copy that already reaches these patients rather than translated afresh: the food
  and day words are the exact strings in `EMAIL_COPY_KA`, `expectedSign` is the portal's own
  `kind_guide` label, and `recoveryCheckIn` is the recovery-log form's title. A dose reminder and
  the email about the same dose disagreeing on the word for "with food" would read as two different
  instructions.

  `tomorrow` and `startingSoon` have no existing Georgian anywhere in the product and are the only
  two strings here that are new.
*/
export const OCCURRENCE_KA_COPY: Record<OccurrenceCopyKey, string> = {
  withFood: 'საკვებთან ერთად',
  withoutFood: 'ცარიელ კუჭზე',
  today: 'დღეს',
  tomorrow: 'ხვალ',
  startingSoon: 'იწყება',
  expectedSign: 'რა არის მოსალოდნელი',
  recoveryCheckIn: 'როგორ მიმდინარეობს აღდგენა?',
};

/**
 * The patient's language, resolved once per rebuild.
 *
 * Georgian is the product's default locale, so a translator was never optional — every occurrence
 * ever generated carried the English table, which put `Take with food. 08:00` on the phone of a
 * patient whose portal, emails and clinic are all Georgian. The plumbing for this existed from the
 * start and simply had no non-English table to reach.
 */
export function occurrenceTranslator(locale: AppLocale): OccurrenceTranslator {
  const copy = locale === 'en' ? OCCURRENCE_EN_COPY : OCCURRENCE_KA_COPY;
  return key => copy[key];
}

/**
 * English, for the pure generator's own default.
 *
 * `buildOccurrences` is deterministic from its arguments and unit-tested without a database or a
 * locale; this keeps that call shape working. Every real caller resolves the patient's language
 * and passes `occurrenceTranslator(locale)` instead.
 */
export const defaultOccurrenceTranslator: OccurrenceTranslator = key => OCCURRENCE_EN_COPY[key];
