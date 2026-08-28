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
import { buildRecoveryLogOccurrences } from '@/features/care-plan/service/recovery-log-occurrence.service';
import { OccurrenceDraft, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import { defaultOccurrenceTranslator } from '@/shared/const/occurrence-copy.const';
import { clock } from '@/shared/lib/clock';

/** PRD 03 §3 — a one-year plan must not write a year of rows on day one. */
export const DEFAULT_HORIZON_DAYS = 90;

const MS_PER_HOUR = 60 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;

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
  /*
    The prescribed instant. Equal to `dueAt` for everything without a lead, which is why the
    builders that have no lead to speak of simply pass the same value rather than leaving it out.
  */
  scheduledAt: Date;
  title: string;
  body: string;
  intensity: OccurrenceDraft['intensity'];
};

type DailySpec = {
  startsOn: Date;
  endsOn: Date;
  daysOfWeek: number[];
  timesOfDay: string[];
  /** Fires each reminder this many minutes before its scheduled time. 0 = at the time itself. */
  remindMinutesBefore?: number | null;
  /** `scheduledAt` is supplied by `dailyDrafts`, which is what knows the lead. */
  build: (dueAt: Date, timeOfDay: string) => Omit<DraftFields, 'scheduledAt'>;
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
    ...buildRecoveryLogOccurrences(context),
  ].sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
}

/** One row per day in `[startsOn, endsOn]` per entry in `timesOfDay`. */
function medicationDrafts(context: GeneratorContext, item: MedicationItem): OccurrenceDraft[] {
  const title = `${item.name} — ${item.dosage}`;
  const foodNote = context.t(item.withFood ? 'withFood' : 'withoutFood');

  return dailyDrafts(context, {
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    daysOfWeek: EVERY_DAY,
    timesOfDay: item.timesOfDay,
    remindMinutesBefore: item.remindMinutesBefore,
    build: (dueAt, timeOfDay) => ({
      kind: 'medication',
      sourceItemId: item._id,
      dueAt,
      title,
      // The dose time stays in the body, so a reminder that arrives early still says when to take it.
      body: `${foodNote} ${timeOfDay}`,
      intensity: null,
    }),
  });
}

/**
 * Same cadence as a medication, and now the same lead time, but only on the weekdays the clinic
 * prescribed.
 *
 * The body is empty, and that is the whole of it. A rehab task is a name, a window, times, a
 * description and how early to warn about it — there is no grade and no category left to
 * summarise, and the title is the instruction. This matches medications, whose `instructions`
 * never reached the reminder either: the notification names the task, the portal holds the detail.
 *
 * `intensity` on the draft is null, as it already was for every other kind. The column stays on the
 * occurrence for the rows that were generated with one; nothing new writes it.
 */
function rehabDrafts(context: GeneratorContext, item: RehabTaskItem): OccurrenceDraft[] {
  const configured = item.daysOfWeek ?? EVERY_DAY;

  return dailyDrafts(context, {
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    daysOfWeek: configured.length > 0 ? configured : EVERY_DAY,
    timesOfDay: item.timesOfDay,
    // Same lead time a dose gets. `?? 0` covers tasks stored before the field existed, which is
    // also the default a clinic that leaves it alone keeps: the reminder lands at the session time.
    remindMinutesBefore: item.remindMinutesBefore ?? 0,
    build: dueAt => ({
      kind: 'rehab',
      sourceItemId: item._id,
      dueAt,
      title: item.title,
      body: '',
      intensity: null,
    }),
  });
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
      // The appointment itself, which is a day ahead of the reminder by default — the largest
      // gap of any kind, and the one where printing `dueAt` would be most wrong.
      scheduledAt: item.scheduledAt,
      title: item.title,
      body,
      intensity: null,
    }),
  ];
}

/** Walks the zone-local calendar so a DST shift keeps the wall-clock time the clinic prescribed. */
function dailyDrafts(context: GeneratorContext, spec: DailySpec): OccurrenceDraft[] {
  /*
    `startsOn` and `endsOn` are dates a clinic picked, stored at UTC midnight — not instants. Read
    as instants they name the intended day only east of UTC; west of it they land the evening
    before, which walked the window a day early at the front and a day short at the end, silently
    dropping the last day of every plan. `civilDateInZone` reads the calendar date they were
    written in and anchors it to local midnight. The horizon is a real instant and stays one.
  */
  const firstDay = clock.civilDateInZone(spec.startsOn, context.timezone);
  const endDay = clock.civilDateInZone(spec.endsOn, context.timezone);

  const lastDay = new Date(Math.min(endDay.getTime(), context.horizonEnd.getTime()));
  if (lastDay.getTime() < firstDay.getTime()) return [];

  const days = clock
    .eachDayInZone(firstDay, lastDay, context.timezone)
    .filter(day => spec.daysOfWeek.includes(clock.weekdayInZone(day, context.timezone)));

  const leadMs = (spec.remindMinutesBefore ?? 0) * MS_PER_MINUTE;

  return days.flatMap(day =>
    spec.timesOfDay.map(timeOfDay => {
      // The zone-local time is resolved first and the lead subtracted from the resulting instant,
      // so a lead that crosses midnight or a DST boundary still lands the prescribed wall clock.
      const scheduledAt = clock.zonedTimeToUtc(day, timeOfDay, context.timezone);
      const dueAt = leadMs > 0 ? new Date(scheduledAt.getTime() - leadMs) : scheduledAt;
      // Applied here rather than in each `build`: the lead is this function's business, and the
      // builders would otherwise each have to re-derive a time they never subtracted from.
      return draft(context, { ...spec.build(dueAt, timeOfDay), scheduledAt });
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
