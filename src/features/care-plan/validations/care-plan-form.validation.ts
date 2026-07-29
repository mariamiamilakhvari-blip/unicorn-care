import { z } from 'zod';

import {
  INTENSITY_VALUES,
  ROUTE_VALUES,
} from '@/features/care-plan/validations/care-plan.validation';

/**
 * Client-side schema for the builder.
 *
 * The API schema coerces dates, which turns an empty input into `Invalid Date` and surfaces as
 * "expected date, received Date" — meaningless to whoever is filling the form. Here the fields
 * stay strings and are checked as strings, so every failure has a message a clinician can act on.
 * Cross-field rules mirror the server exactly; the server remains the authority.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const RequiredDate = z.string().min(1, { message: 'Required' });

const TimesOfDay = z
  .array(z.string().regex(TIME_PATTERN, { message: 'Use HH:mm' }))
  .min(1, { message: 'Add at least one time' })
  .max(6, { message: 'At most six times a day' })
  .refine(times => new Set(times).size === times.length, { message: 'Times must be different' });

const MedicationRow = z
  .object({
    name: z.string().min(1, { message: 'Required' }).max(120),
    dosage: z.string().min(1, { message: 'Required' }).max(60),
    route: z.enum(ROUTE_VALUES),
    timesOfDay: TimesOfDay,
    startsOn: RequiredDate,
    endsOn: RequiredDate,
    withFood: z.boolean(),
    instructions: z.string().max(500),
    remindHoursBefore: z.number().int().min(0).max(336),
  })
  .refine(item => item.endsOn >= item.startsOn, {
    message: 'End date is before the start date',
    path: ['endsOn'],
  });

const RehabTaskRow = z
  .object({
    title: z.string().min(1, { message: 'Required' }).max(120),
    description: z.string().max(500),
    intensity: z.enum(INTENSITY_VALUES),
    durationMinutes: z.number().int().min(0).max(600),
    timesOfDay: TimesOfDay,
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, { message: 'Pick at least one day' }),
    startsOn: RequiredDate,
    endsOn: RequiredDate,
    remindHoursBefore: z.number().int().min(0).max(336),
  })
  .refine(item => item.endsOn >= item.startsOn, {
    message: 'End date is before the start date',
    path: ['endsOn'],
  });

const CheckupRow = z.object({
  scheduledAt: RequiredDate,
  title: z.string().min(1, { message: 'Required' }).max(120),
  location: z.string().max(200),
  remindHoursBefore: z.number().int().min(0).max(336),
});

export const CarePlanFormSchema = z
  .object({
    startsAt: RequiredDate,
    rehabEndsAt: RequiredDate,
    medications: z.array(MedicationRow).max(30),
    rehabTasks: z.array(RehabTaskRow).max(30),
    checkups: z.array(CheckupRow).max(30),
  })
  .superRefine((plan, ctx) => {
    if (plan.rehabEndsAt <= plan.startsAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Rehab must end after the plan starts',
        path: ['rehabEndsAt'],
      });
    }

    // Dosing and rehab have to sit inside the plan window. Checkups may fall after it — a
    // follow-up appointment after rehabilitation ends is normal.
    const nested = (from: string, to: string) => from >= plan.startsAt && to <= plan.rehabEndsAt;

    plan.medications.forEach((item, index) => {
      if (nested(item.startsOn, item.endsOn)) return;
      ctx.addIssue({
        code: 'custom',
        message: 'Dates must fall inside the plan window',
        path: ['medications', index, 'startsOn'],
      });
    });

    plan.rehabTasks.forEach((item, index) => {
      if (nested(item.startsOn, item.endsOn)) return;
      ctx.addIssue({
        code: 'custom',
        message: 'Dates must fall inside the plan window',
        path: ['rehabTasks', index, 'startsOn'],
      });
    });

    plan.checkups.forEach((item, index) => {
      if (item.scheduledAt.slice(0, 10) >= plan.startsAt) return;
      ctx.addIssue({
        code: 'custom',
        message: 'Checkup is before the plan starts',
        path: ['checkups', index, 'scheduledAt'],
      });
    });
  });

export type CarePlanFormValues = z.infer<typeof CarePlanFormSchema>;
