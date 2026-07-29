import {
  CarePlanDocument,
  CheckupItem,
  MedicationItem,
  RehabTaskItem,
} from '@/features/care-plan/schema/care-plan.schema';
import {
  buildGuideOccurrences,
  RecoveryGuideForOccurrences,
} from '@/features/care-plan/service/guide-occurrence.service';
import { OccurrenceDraft, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import { defaultOccurrenceTranslator } from '@/shared/const/occurrence-copy.const';
import { clock } from '@/shared/lib/clock';

/** PRD 03 §3 — a one-year plan must not write a year of rows on day one. */
export const DEFAULT_HORIZON_DAYS = 90;

const MS_PER_HOUR = 60 * 60 * 1000;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

type GeneratorContext = {
  plan: CarePlanDocument;
  timezone: string;
  horizonEnd: Date;
  generatedAt: Date;
  t: OccurrenceTranslator;
};

type DraftFields = {
  kind: OccurrenceDraft['kind'];
  sourceItemId: OccurrenceDraft['sourceItemId'];
  dueAt: Date;
  title: string;
  body: string;
  intensity: OccurrenceDraft['intensity'];
};

type DailySpec = {
  startsOn: Date;
  endsOn: Date;
  daysOfWeek: number[];
  timesOfDay: string[];
  build: (dueAt: Date, timeOfDay: string) => DraftFields;
};

/**
 * Materialise every reminder a plan owes, as pure data — no DB, no clock reads, no `next-intl`.
 * Everything time-shaped goes through `clock`, and every translatable word through `t`, so the
 * whole function is deterministic from its arguments and unit-testable across a DST boundary.
 *
 * `title` / `body` are rendered here and stored on the row, so the dispatch cron is a pure read
 * (PRD 03 §3). A `body` never carries a diagnosis or a procedure name: a lock-screen preview is
 * readable by anyone holding the phone (PRD 04). Free-text medication `instructions` are left out
 * of the push for the same reason — they belong to the portal, behind a login.
 *
 * `generatedAt` only fills the Mongoose `timestamps` fields, which the driver overwrites on insert;
 * it is a parameter so a test can pin every field of the output.
 */
export function buildOccurrences(
  plan: CarePlanDocument,
  timezone: string,
  horizonDays: number = DEFAULT_HORIZON_DAYS,
  translate: OccurrenceTranslator = defaultOccurrenceTranslator,
  generatedAt: Date = clock.now(),
  guide: RecoveryGuideForOccurrences | null = null
): OccurrenceDraft[] {
  const context: GeneratorContext = {
    plan,
    timezone,
    horizonEnd: clock.addDays(plan.startsAt, horizonDays),
    generatedAt,
    t: translate,
  };

  return [
    ...plan.medications.flatMap(item => medicationDrafts(context, item)),
    ...plan.rehabTasks.flatMap(item => rehabDrafts(context, item)),
    ...plan.checkups.flatMap(item => checkupDrafts(context, item)),
    ...buildGuideOccurrences(context, guide),
  ].sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
}

/** One row per day in `[startsOn, endsOn]` per entry in `timesOfDay`. */
function medicationDrafts(context: GeneratorContext, item: MedicationItem): OccurrenceDraft[] {
  const title = `${item.name} — ${item.dosage}`;
  const foodNote = context.t(item.withFood ? 'withFood' : 'withoutFood');

  const doses = dailyDrafts(context, {
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    daysOfWeek: EVERY_DAY,
    timesOfDay: item.timesOfDay,
    build: (dueAt, timeOfDay) => ({
      kind: 'medication',
      sourceItemId: item._id,
      dueAt,
      title,
      body: `${foodNote} ${timeOfDay}`,
      intensity: null,
    }),
  });

  return [...advanceDrafts(context, doses, 'medication', item._id, title, item.remindHoursBefore), ...doses];
}

/** Same cadence as a medication, but only on the weekdays the clinic prescribed. */
function rehabDrafts(context: GeneratorContext, item: RehabTaskItem): OccurrenceDraft[] {
  const minutes = item.durationMinutes ?? 0;
  const duration = minutes > 0 ? ` · ${minutes} ${context.t('minutesShort')}` : '';
  const body = `${context.t(item.intensity)}${duration}`;
  const configured = item.daysOfWeek ?? EVERY_DAY;

  const sessions = dailyDrafts(context, {
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    daysOfWeek: configured.length > 0 ? configured : EVERY_DAY,
    timesOfDay: item.timesOfDay,
    build: dueAt => ({
      kind: 'rehab',
      sourceItemId: item._id,
      dueAt,
      title: item.title,
      body,
      intensity: item.intensity,
    }),
  });

  return [
    ...advanceDrafts(context, sessions, 'rehab', item._id, item.title, item.remindHoursBefore),
    ...sessions,
  ];
}

/** A single row, `remindHoursBefore` ahead of the appointment. */
function checkupDrafts(context: GeneratorContext, item: CheckupItem): OccurrenceDraft[] {
  const remindHoursBefore = item.remindHoursBefore ?? 24;
  const dueAt = new Date(item.scheduledAt.getTime() - remindHoursBefore * MS_PER_HOUR);
  if (dueAt.getTime() > context.horizonEnd.getTime()) return [];

  const at = localTime(item.scheduledAt, context.timezone);
  const when = `${dayLabel(context, dueAt, item.scheduledAt)} ${at}`;
  const body = [when, item.location ?? ''].filter(part => part.length > 0).join(' · ');

  return [
    draft(context, {
      kind: 'checkup',
      sourceItemId: item._id,
      dueAt,
      title: item.title,
      body,
      intensity: null,
    }),
  ];
}

/**
 * One heads-up ahead of the *first* dose or session, mirroring a checkup's `remindHoursBefore`.
 *
 * Deliberately not one per dose. A lead time longer than a day — the 30 hours a clinic is likely
 * to set — would land the notice during the previous day's dose, so the patient would be told to
 * prepare for something they are already mid-course on. Announcing the course once is the useful
 * signal; the per-dose rows still fire at their own times and are what actually gets taken.
 *
 * `0` means no advance notice, so plans written before this field existed are unchanged.
 */
function advanceDrafts(
  context: GeneratorContext,
  scheduled: OccurrenceDraft[],
  kind: OccurrenceDraft['kind'],
  sourceItemId: OccurrenceDraft['sourceItemId'],
  title: string,
  remindHoursBefore: number | null | undefined
): OccurrenceDraft[] {
  const hours = remindHoursBefore ?? 0;
  if (hours <= 0 || scheduled.length === 0) return [];

  const first = scheduled[0];
  const dueAt = new Date(first.dueAt.getTime() - hours * MS_PER_HOUR);
  if (dueAt.getTime() > context.horizonEnd.getTime()) return [];

  const when = `${dayLabel(context, dueAt, first.dueAt)} ${localTime(first.dueAt, context.timezone)}`;

  return [
    draft(context, {
      kind,
      sourceItemId,
      dueAt,
      title,
      body: `${context.t('startingSoon')} ${when}`,
      intensity: null,
    }),
  ];
}

/** Walks the zone-local calendar so a DST shift keeps the wall-clock time the clinic prescribed. */
function dailyDrafts(context: GeneratorContext, spec: DailySpec): OccurrenceDraft[] {
  const lastDay = new Date(Math.min(spec.endsOn.getTime(), context.horizonEnd.getTime()));
  if (lastDay.getTime() < spec.startsOn.getTime()) return [];

  const days = clock
    .eachDayInZone(spec.startsOn, lastDay, context.timezone)
    .filter(day => spec.daysOfWeek.includes(clock.weekdayInZone(day, context.timezone)));

  return days.flatMap(day =>
    spec.timesOfDay.map(timeOfDay => {
      const dueAt = clock.zonedTimeToUtc(day, timeOfDay, context.timezone);
      return draft(context, spec.build(dueAt, timeOfDay));
    })
  );
}

function draft(context: GeneratorContext, fields: DraftFields): OccurrenceDraft {
  return {
    carePlanId: context.plan._id,
    patientId: context.plan.patientId,
    clinicId: context.plan.clinicId,
    status: 'pending',
    sentAt: null,
    completedAt: null,
    createdAt: context.generatedAt,
    updatedAt: context.generatedAt,
    ...fields,
  };
}

/** `Today` / `Tomorrow` when the reminder lands within a day of the appointment, else `DD/MM`. */
function dayLabel(context: GeneratorContext, dueAt: Date, scheduledAt: Date): string {
  const gap = clock.eachDayInZone(dueAt, scheduledAt, context.timezone).length - 1;
  if (gap <= 0) return context.t('today');
  if (gap === 1) return context.t('tomorrow');
  return zonedLabel(scheduledAt, context.timezone, { day: '2-digit', month: '2-digit' });
}

function localTime(date: Date, timeZone: string): string {
  return zonedLabel(date, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** Formatting only — every date *calculation* goes through `clock`. Numeric fields keep the copy locale-neutral. */
function zonedLabel(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(date);
}
