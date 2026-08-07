import { AppLocale } from '@/shared/types/roles';

/** The window a report covers, as ISO instants. */
export type AnalyticsRange = {
  from: string;
  to: string;
  /** Set when the range came from a quarter rather than two dates. */
  label: string;
};

/**
 * A rate the caller must not compute itself.
 *
 * `rate` is `null` when `attempted` is zero — there is no such thing as a delivery rate over no
 * attempts, and returning 0 would put a red number on a report for a clinic that simply had a
 * quiet quarter. The UI renders null as "no data", not as zero.
 */
export type Rate = {
  delivered: number;
  attempted: number;
  rate: number | null;
};

export type ChannelDelivery = {
  push: Rate;
  email: Rate;
};

export type LocaleSplit = {
  locale: AppLocale;
  count: number;
  share: number;
};

/**
 * The estimate, with its inputs exposed.
 *
 * `assumptionMinutes` travels with the number so the screen and the email can state what it rests
 * on. A figure like "45 hours saved" is only honest while the reader can see it is 2 minutes ×
 * 1,350 delivered reminders and disagree with the 2.
 */
export type HoursSaved = {
  hours: number;
  fromReminders: number;
  fromOnboarding: number;
  minutesPerReminder: number;
  minutesPerPatient: number;
};

export type ClinicAnalytics = {
  clinicId: string;
  clinicName: string;
  range: AnalyticsRange;
  activePatients: number;
  newPatients: number;
  /** Occurrences whose `dueAt` fell in the window, by what became of them. */
  reminders: {
    total: number;
    dispatched: number;
    done: number;
    skipped: number;
    missed: number;
    pending: number;
  };
  delivery: ChannelDelivery;
  /** Confirmed over everything the patient could have answered. `null` when nothing was due. */
  adherenceRate: number | null;
  locales: LocaleSplit[];
  hoursSaved: HoursSaved;
};

export type AnalyticsClinicOption = {
  id: string;
  name: string;
};
