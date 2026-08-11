import { ReminderStatus } from '@/features/care-plan/schema/reminder-occurrence.schema';

/** JSON-safe occurrence as the patient portal renders it. */
export type PortalOccurrence = {
  id: string;
  kind: 'medication' | 'rehab' | 'checkup' | 'guide' | 'recovery_log';
  title: string;
  body: string;
  intensity: 'light' | 'moderate' | 'intense' | null;
  /** When the reminder is sent. The portal never prints this — see `scheduledAt`. */
  dueAt: string;
  /**
   * When the patient is meant to act. This is the time the portal shows: a 5-minute lead is an
   * instruction to the dispatcher, not a change to the dose time, and printing `dueAt` told a
   * patient to take a 09:30 dose at 09:25.
   */
  scheduledAt: string;
  status: ReminderStatus;
};

/**
 * One calendar day of the patient's plan. The portal only ever shows a bounded window — a
 * patient looking at a whole 90-day horizon is noise, not care.
 */
export type PortalDay = {
  /** `YYYY-MM-DD` in `timeZone`, not in UTC — the calendar day the patient is living in. */
  date: string;
  occurrences: PortalOccurrence[];
};

export type PortalPlanView = {
  todayIso: string;
  /** Today as a `PortalDay.date`, so the client compares keys instead of re-deriving a day. */
  todayKey: string;
  /**
   * The clinic's zone. Every prescribed time is wall clock in it, so it is also the only zone the
   * portal may render in: formatting in the server's zone showed a UTC+4 patient a 09:30 dose at
   * 05:30, and formatting in the browser's would move the dose whenever the patient travelled.
   */
  timeZone: string;
  days: PortalDay[];
  nextCheckup: PortalOccurrence | null;
  rehabEndsAt: string | null;
};
