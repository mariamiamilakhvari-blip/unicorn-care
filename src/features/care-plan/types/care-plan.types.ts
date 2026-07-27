import { ReminderOccurrenceInput, ReminderStatus } from '@/features/care-plan/schema/reminder-occurrence.schema';

/**
 * A not-yet-persisted `ReminderOccurrence`. `buildOccurrences` returns these and the repository
 * inserts them verbatim, so the alias keeps the generator and `insertMany` structurally locked
 * together — a schema change surfaces as a typecheck error in the generator, not at runtime.
 */
export type OccurrenceDraft = ReminderOccurrenceInput;

/**
 * The only strings in a push payload that are language, not data.
 *
 * `buildOccurrences` stays pure by taking a translator instead of importing `next-intl/server`:
 * the caller resolves the patient's locale once and passes a plain lookup down (PRD 03 §3).
 */
export type OccurrenceCopyKey =
  | 'withFood'
  | 'withoutFood'
  | 'minutesShort'
  | 'today'
  | 'tomorrow'
  | 'light'
  | 'moderate'
  | 'intense';

export type OccurrenceTranslator = (key: OccurrenceCopyKey) => string;

/** Totals per reminder status across the patient's active plans (PRD 03 §5). */
export type AdherenceTotals = Record<ReminderStatus, number>;

/**
 * One bucket of the trailing-week strip. `date` is the UTC instant of clinic-local midnight for
 * that day, so the client formats it in the viewer's locale without re-deriving the zone.
 */
export type AdherenceDayBucket = {
  date: string;
  total: number;
  done: number;
  skipped: number;
  missed: number;
  pending: number;
  sent: number;
};

export type AdherenceSummary = {
  patientId: string;
  totals: AdherenceTotals;
  lastSevenDays: AdherenceDayBucket[];
};

/** JSON-safe care plan shape the API returns — `NextResponse.json` stringifies ids and dates. */
export type CarePlanView = {
  _id: string;
  procedureId: string;
  patientId: string;
  clinicId: string;
  startsAt: string;
  rehabEndsAt: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
};
