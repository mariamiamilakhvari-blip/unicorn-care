import {
  CarePlanFormType,
  CheckupFormRow,
  MedicationFormRow,
  RehabTaskFormRow,
} from '@/features/care-plan/types/care-plan-form.types';

/**
 * A stored plan as it arrives over JSON. Dates are ISO strings, subdocuments keep their `_id`.
 * Declared here rather than reusing the Mongoose document type so no client code imports Mongoose.
 */
export type StoredCarePlan = {
  _id: string;
  procedureId: string;
  patientId: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  startsAt: string;
  rehabEndsAt: string;
  medications?: Array<Omit<MedicationFormRow, 'startsOn' | 'endsOn'> & {
    startsOn: string;
    endsOn: string;
  }>;
  rehabTasks?: Array<Omit<RehabTaskFormRow, 'startsOn' | 'endsOn'> & {
    startsOn: string;
    endsOn: string;
  }>;
  checkups?: Array<Omit<CheckupFormRow, 'scheduledAt'> & { scheduledAt: string }>;
};

/** `yyyy-MM-dd` — what a native date input expects. */
function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

/** `yyyy-MM-ddTHH:mm` — what a native datetime-local input expects, seconds and zone dropped. */
function toDateTimeInput(iso: string): string {
  return iso ? iso.slice(0, 16) : '';
}

/**
 * Turns a saved plan back into builder form values, so reopening a patient shows what was stored
 * instead of an empty form.
 */
export function toCarePlanFormValues(plan: StoredCarePlan): CarePlanFormType {
  return {
    startsAt: toDateInput(plan.startsAt),
    rehabEndsAt: toDateInput(plan.rehabEndsAt),
    medications: (plan.medications ?? []).map(item => ({
      name: item.name,
      dosage: item.dosage,
      route: item.route,
      timesOfDay: [...item.timesOfDay],
      startsOn: toDateInput(item.startsOn),
      endsOn: toDateInput(item.endsOn),
      withFood: item.withFood,
      instructions: item.instructions ?? '',
      // Plans written before this field existed fire at the dose time; 0 keeps them as they were.
      remindMinutesBefore: item.remindMinutesBefore ?? 0,
    })),
    rehabTasks: (plan.rehabTasks ?? []).map(item => ({
      title: item.title,
      description: item.description ?? '',
      intensity: item.intensity,
      durationMinutes: item.durationMinutes ?? 0,
      timesOfDay: [...item.timesOfDay],
      daysOfWeek: [...item.daysOfWeek],
      startsOn: toDateInput(item.startsOn),
      endsOn: toDateInput(item.endsOn),
      remindMinutesBefore: item.remindMinutesBefore ?? 0,
    })),
    checkups: (plan.checkups ?? []).map(item => ({
      scheduledAt: toDateTimeInput(item.scheduledAt),
      title: item.title,
      location: item.location ?? '',
      remindHoursBefore: item.remindHoursBefore ?? 24,
    })),
  };
}
