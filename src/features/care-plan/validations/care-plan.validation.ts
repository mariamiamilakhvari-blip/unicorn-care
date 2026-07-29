import { z } from 'zod';

import { clock } from '@/shared/lib/clock';

const ObjectIdSchema = z.string().min(24).max(24);

/**
 * Accepts ISO strings from the browser and real `Date`s from a loaded document alike.
 *
 * The refinement is what stops an empty input reporting "expected date, received Date": coercion
 * turns `''` into an Invalid Date, which passes the type check and fails unhelpfully downstream.
 */
const DateSchema = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.date({ message: 'Enter a valid date' })
);

/** The persisted Mongoose enums (PRD 01 §6) — the schema, not the label catalogue, is the source. */
export const ROUTE_VALUES = ['oral', 'topical', 'injection', 'other'] as const;
export const INTENSITY_VALUES = ['light', 'moderate', 'intense'] as const;

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
    intensity: z.enum(INTENSITY_VALUES),
    durationMinutes: z.number().int().min(0).max(600).default(0),
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
 * `procedureId` / `patientId` are body fields; `clinicId` is deliberately absent — it always comes
 * from `clinicGuard` (PRD 02).
 */
const CarePlanBaseSchema = z.object({
  procedureId: ObjectIdSchema,
  patientId: ObjectIdSchema,
  startsAt: DateSchema,
  rehabEndsAt: DateSchema,
  medications: z.array(MedicationSchema).max(30).default([]),
  rehabTasks: z.array(RehabTaskSchema).max(30).default([]),
  checkups: z.array(CheckupSchema).max(30).default([]),
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
