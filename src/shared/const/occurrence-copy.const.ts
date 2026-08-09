import { OccurrenceCopyKey, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';

/**
 * The English fallback for every translatable word that can appear in a push payload.
 *
 * `buildOccurrences` renders `title`/`body` once, at generation time, so dispatch is a pure read.
 * A caller that knows the patient's locale passes its own translator instead of this one.
 */
export const OCCURRENCE_EN_COPY: Record<OccurrenceCopyKey, string> = {
  withFood: 'Take with food.',
  withoutFood: 'Take on an empty stomach.',
  minutesShort: 'min',
  today: 'Today',
  tomorrow: 'Tomorrow',
  light: 'Light',
  moderate: 'Moderate',
  intense: 'Intense',
  startingSoon: 'Starts',
  expectedSign: 'This is expected',
  recoveryCheckIn: 'How is your recovery going?',
};

export const defaultOccurrenceTranslator: OccurrenceTranslator = key => OCCURRENCE_EN_COPY[key];
