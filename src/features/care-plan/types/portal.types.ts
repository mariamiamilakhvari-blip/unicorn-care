import { ReminderStatus } from '@/features/care-plan/schema/reminder-occurrence.schema';

/** JSON-safe occurrence as the patient portal renders it. */
export type PortalOccurrence = {
  id: string;
  kind: 'medication' | 'rehab' | 'checkup' | 'guide';
  title: string;
  body: string;
  intensity: 'light' | 'moderate' | 'intense' | null;
  dueAt: string;
  status: ReminderStatus;
};

/**
 * One calendar day of the patient's plan. The portal only ever shows a bounded window — a
 * patient looking at a whole 90-day horizon is noise, not care.
 */
export type PortalDay = {
  date: string;
  occurrences: PortalOccurrence[];
};

export type PortalPlanView = {
  todayIso: string;
  days: PortalDay[];
  nextCheckup: PortalOccurrence | null;
  rehabEndsAt: string | null;
};
