import { INTENSITY_VALUES, ROUTE_VALUES } from '@/features/care-plan/validations/care-plan.validation';

/**
 * The builder's own shape. Dates are `yyyy-MM-dd` / `datetime-local` strings because that is what
 * native date inputs emit; the Zod schema coerces them on submit. Keeping the form type separate
 * from `CreateCarePlanType` is what stops `z.coerce.date()` fighting the controlled inputs.
 */
export type MedicationFormRow = {
  name: string;
  dosage: string;
  route: (typeof ROUTE_VALUES)[number];
  timesOfDay: string[];
  startsOn: string;
  endsOn: string;
  withFood: boolean;
  instructions: string;
  remindMinutesBefore: number;
};

export type RehabTaskFormRow = {
  title: string;
  description: string;
  intensity: (typeof INTENSITY_VALUES)[number];
  durationMinutes: number;
  timesOfDay: string[];
  daysOfWeek: number[];
  startsOn: string;
  endsOn: string;
  remindMinutesBefore: number;
};

export type CheckupFormRow = {
  scheduledAt: string;
  title: string;
  location: string;
  remindHoursBefore: number;
};

export type CarePlanFormType = {
  startsAt: string;
  rehabEndsAt: string;
  medications: MedicationFormRow[];
  rehabTasks: RehabTaskFormRow[];
  checkups: CheckupFormRow[];
};

export const EMPTY_MEDICATION: MedicationFormRow = {
  name: '',
  dosage: '',
  route: 'oral',
  timesOfDay: ['08:00'],
  startsOn: '',
  endsOn: '',
  withFood: false,
  instructions: '',
  // 0 = fires at the dose time, matching how every plan behaved before the field existed.
  remindMinutesBefore: 0,
};

export const EMPTY_REHAB_TASK: RehabTaskFormRow = {
  title: '',
  description: '',
  intensity: 'light',
  durationMinutes: 10,
  timesOfDay: ['09:00'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startsOn: '',
  endsOn: '',
  remindMinutesBefore: 0,
};

export const EMPTY_CHECKUP: CheckupFormRow = {
  scheduledAt: '',
  title: '',
  location: '',
  remindHoursBefore: 24,
};
