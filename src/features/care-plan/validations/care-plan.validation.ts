import { z } from 'zod';

import { clock } from '@/shared/lib/clock';

const ObjectIdSchema = z.string().min(24).max(24);

/**
 * A `datetime-local` value: `YYYY-MM-DDTHH:mm`, optionally with seconds, and carrying no zone.
 *
 * Anchored, not resolved. Date-*only* strings are already UTC by specification, but a zoneless
 * date-*time* is resolved against the running process's zone — so the same payload parsed to a
 * different instant on a developer's laptop than on Vercel. Pinning it to UTC makes the parse
 * deterministic; the appointment is then re-anchored in the clinic's real zone by
 * `toContentPatch`, in the service layer — the only layer that knows what that zone is.
 */
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * Accepts ISO strings from the browser and real `Date`s from a loaded document alike.
 *
 * The refinement is what stops an empty input reporting "expected date, received Date": coercion
 * turns `''` into an Invalid Date, which passes the type check and fails unhelpfully downstream.
 */
const DateSchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  if (value.trim() === '') return undefined;
  return ZONELESS_DATE_TIME.test(value) ? `${value}Z` : value;
}, z.coerce.date({ message: 'Enter a valid date' }));

/** The persisted Mongoose enums (PRD 01 §6) — the schema, not the label catalogue, is the source. */
export const ROUTE_VALUES = ['oral', 'topical', 'injection', 'other'] as const;

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 24h clinic-local wall clock: at least one entry, at most six a day, never the same time twice. */
const TimesOfDaySchema = z
  .array(z.string().regex(TIME_OF_DAY_PATTERN, { message: 'INVALID_TIME_OF_DAY' }))
  .min(1)
  .max(6)
  .refine(times => new Set(times).size === times.length, { message: 'DUPLICATE_TIME_OF_DAY' });

const MedicationSchema = z
  .object({
    name: z.string().min(1).max(120),
    dosage: z.string().min(1).max(60),
    route: z.enum(ROUTE_VALUES),
    timesOfDay: TimesOfDaySchema,
    startsOn: DateSchema,
    endsOn: DateSchema,
    withFood: z.boolean().default(false),
    instructions: z.string().max(500).default(''),
    remindMinutesBefore: z.number().int().min(0).max(1440).default(0),
  })
  .refine(item => item.endsOn.getTime() >= item.startsOn.getTime(), {
    message: 'ENDS_BEFORE_STARTS',
    path: ['endsOn'],
  });

const RehabTaskSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(500).default(''),
    timesOfDay: TimesOfDaySchema,
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine(days => new Set(days).size === days.length, { message: 'DUPLICATE_DAY_OF_WEEK' })
      .default([0, 1, 2, 3, 4, 5, 6]),
    startsOn: DateSchema,
    endsOn: DateSchema,
    remindMinutesBefore: z.number().int().min(0).max(1440).default(0),
  })
  .refine(item => item.endsOn.getTime() >= item.startsOn.getTime(), {
    message: 'ENDS_BEFORE_STARTS',
    path: ['endsOn'],
  });

const CheckupSchema = z.object({
  scheduledAt: DateSchema,
  title: z.string().min(1).max(120),
  location: z.string().max(200).default(''),
  remindHoursBefore: z.number().int().min(0).max(336).default(24),
});

/**
 * Drops rows a clinician opened and never filled in.
 *
 * Each of the three sections appends a blank block when its "add" button is pressed, and all
 * three are optional — plenty of plans are medication and a checkup, or rehab alone. A clinician
 * who adds a block and changes their mind was left with a plan that could not be saved and a
 * column of red `Required` labels explaining nothing about what to do.
 *
 * Only *entirely* untouched rows are dropped. A row with a name but no dates is a clinician who
 * started describing real work and was interrupted; silently discarding it would delete clinical
 * intent and the plan would activate missing something somebody meant to prescribe. Those still
 * fail validation, which is the honest outcome — the fix is to finish the row or delete it.
 */
type TypedRow = Record<string, unknown>;

/** True when every field a clinician would have typed into is still blank. */
const allBlank =
  (fields: string[]) =>
    (row: TypedRow): boolean =>
      fields.every(field => !String(row?.[field] ?? '').trim());

/*
  The fields listed per section are the ones a clinician types into. Anything defaulted by the
  form — route, times of day, reminder offsets — is deliberately excluded: those carry
  a value on an untouched row, so counting them would make every blank block look filled in.
*/
export const isUntouchedMedicationRow = allBlank([
  'name',
  'dosage',
  'startsOn',
  'endsOn',
  'instructions',
]);

export const isUntouchedRehabRow = allBlank(['title', 'description', 'startsOn', 'endsOn']);

export const isUntouchedCheckupRow = allBlank(['scheduledAt', 'title', 'location']);

const dropUntouched =
  (isBlank: (row: TypedRow) => boolean) =>
    (value: unknown) =>
      Array.isArray(value) ? value.filter(row => !isBlank(row as TypedRow)) : value;

/**
 * `procedureId` / `patientId` are body fields; `clinicId` is deliberately absent — it always comes
 * from `clinicGuard` (PRD 02).
 */
const CarePlanBaseSchema = z.object({
  procedureId: ObjectIdSchema,
  patientId: ObjectIdSchema,
  startsAt: DateSchema,
  rehabEndsAt: DateSchema,
  /*
    Whether this plan asks the patient how recovery is going, on the decreasing cadence in
    `RECOVERY_LOG_CADENCE`. Defaults to false: turning it on adds a recurring evening prompt to
    someone's phone, which is a change to what the clinic asks of them and not a default.
  */
  recoveryLogEnabled: z.boolean().default(false),
  medications: z.preprocess(
    dropUntouched(isUntouchedMedicationRow),
    z.array(MedicationSchema).max(30).default([])
  ),
  rehabTasks: z.preprocess(
    dropUntouched(isUntouchedRehabRow),
    z.array(RehabTaskSchema).max(30).default([])
  ),
  checkups: z.preprocess(
    dropUntouched(isUntouchedCheckupRow),
    z.array(CheckupSchema).max(30).default([])
  ),
});

const CarePlanContentSchema = CarePlanBaseSchema.omit({ procedureId: true, patientId: true });

type CarePlanContent = z.infer<typeof CarePlanContentSchema>;

function addIssue(ctx: z.RefinementCtx, message: string, path: (string | number)[]): void {
  ctx.addIssue({ code: 'custom', message, path });
}

/**
 * `rehabEndsAt > startsAt`, with dosing and rehab windows nested inside the plan window.
 *
 * Checkups are deliberately NOT bounded above. A follow-up appointment scheduled after
 * rehabilitation ends is ordinary clinical practice — the earlier rule rejected it and made
 * legitimate plans unsaveable. They only have to fall on or after the plan start.
 */
function checkWindows(plan: CarePlanContent, ctx: z.RefinementCtx): void {
  const from = plan.startsAt.getTime();
  const to = plan.rehabEndsAt.getTime();
  if (to <= from) addIssue(ctx, 'REHAB_ENDS_BEFORE_START', ['rehabEndsAt']);

  const inWindow = (value: Date) => value.getTime() >= from && value.getTime() <= to;

  plan.medications.forEach((item, index) => {
    if (inWindow(item.startsOn) && inWindow(item.endsOn)) return;
    addIssue(ctx, 'OUTSIDE_PLAN_WINDOW', ['medications', index]);
  });
  plan.rehabTasks.forEach((item, index) => {
    if (inWindow(item.startsOn) && inWindow(item.endsOn)) return;
    addIssue(ctx, 'OUTSIDE_PLAN_WINDOW', ['rehabTasks', index]);
  });
  plan.checkups.forEach((item, index) => {
    if (item.scheduledAt.getTime() >= from) return;
    addIssue(ctx, 'CHECKUP_BEFORE_PLAN_START', ['checkups', index]);
  });
}

/** Only on create — an existing plan keeps checkups that have since gone past. */
function checkFutureCheckups(plan: CarePlanContent, ctx: z.RefinementCtx): void {
  const now = clock.now().getTime();
  plan.checkups.forEach((item, index) => {
    if (item.scheduledAt.getTime() > now) return;
    addIssue(ctx, 'CHECKUP_IN_THE_PAST', ['checkups', index, 'scheduledAt']);
  });
}

/**
 * Draft schema — lenient on purpose. A half-built plan with no items at all still saves, so the
 * builder page can persist between sections (PRD 03 §2).
 */
export const CreateCarePlanSchema = CarePlanBaseSchema.superRefine((plan, ctx) => {
  checkWindows(plan, ctx);
  checkFutureCheckups(plan, ctx);
});

/** Editing an existing plan: the plan never moves between procedures or patients. */
export const UpdateCarePlanSchema = CarePlanContentSchema.superRefine(checkWindows);

/**
 * Strict completeness gate, run against the stored document before activation — a plan with
 * nothing to remind about would materialise zero occurrences (PRD 03 §2, §Activation).
 */
export const ActivateCarePlanSchema = CarePlanContentSchema.superRefine((plan, ctx) => {
  checkWindows(plan, ctx);
  const items = plan.medications.length + plan.rehabTasks.length + plan.checkups.length;
  if (items === 0) addIssue(ctx, 'PLAN_HAS_NO_ITEMS', ['medications']);
});

export type CreateCarePlanType = z.infer<typeof CreateCarePlanSchema>;
export type UpdateCarePlanType = z.infer<typeof UpdateCarePlanSchema>;
export type MedicationInputType = z.infer<typeof MedicationSchema>;
export type RehabTaskInputType = z.infer<typeof RehabTaskSchema>;
export type CheckupInputType = z.infer<typeof CheckupSchema>;
