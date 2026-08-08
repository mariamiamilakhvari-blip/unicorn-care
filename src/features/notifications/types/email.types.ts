import { AppLocale } from '@/shared/types/roles';

/**
 * Plain data the email builders consume. Deliberately not the Mongoose document types: the builders
 * are pure so they can be unit-tested without a database, and an email must never depend on a
 * lazily-populated field.
 */
export type EmailPatient = {
  firstName: string;
  lastName: string;
  email: string;
  locale: AppLocale;
};

/**
 * The clinic as an email footer needs it.
 *
 * Every field but `name` and `timezone` is optional in practice — the profile form requires none
 * of them — so each arrives as a possibly-empty string and the footer omits what is empty rather
 * than printing a stranded label. A patient reading "Phone:" with nothing after it learns only
 * that something is broken.
 */
export type EmailClinic = {
  name: string;
  addressLine: string;
  phone: string;
  email: string;
  timezone: string;
};

export type EmailProcedure = {
  manipulationType: string;
  performedAt: Date;
  operatorName: string;
};

export type EmailMedication = {
  name: string;
  dosage: string;
  timesOfDay: string[];
  startsOn: Date;
  endsOn: Date;
  withFood: boolean;
};

export type EmailRehabTask = {
  title: string;
  intensity: 'light' | 'moderate' | 'intense';
  durationMinutes: number;
  timesOfDay: string[];
  daysOfWeek: number[];
  startsOn: Date;
  endsOn: Date;
};

export type EmailCheckup = {
  title: string;
  scheduledAt: Date;
  location: string;
};

export type EmailGuide = {
  expected: { title: string; description: string; fromDay: number; toDay: number }[];
  warning: { title: string; description: string; severity: string; fromDay: number; toDay: number }[];
};

export type WelcomeEmailInput = {
  patient: EmailPatient;
  clinic: EmailClinic;
  procedure: EmailProcedure | null;
  medications: EmailMedication[];
  rehabTasks: EmailRehabTask[];
  checkups: EmailCheckup[];
  guide: EmailGuide | null;
};

export type DailyEmailInput = {
  patient: EmailPatient;
  clinic: EmailClinic;
  /** Only what falls on the patient's recovery day this email covers. */
  medications: EmailMedication[];
  rehabTasks: EmailRehabTask[];
  nextCheckup: EmailCheckup | null;
  daysUntilCheckup: number | null;
  guide: EmailGuide | null;
  /** Days since the operation, used to pick which guide entries still apply. */
  recoveryDay: number;
};

/**
 * One reminder about one thing, at the moment it is due.
 *
 * `title` and `body` are copied straight off the occurrence, which had them rendered in the
 * patient's locale when the plan was activated — the same strings the push notification carries.
 * Nothing clinical is composed at send time, here or anywhere else in dispatch.
 *
 * `dueAt` is already the scheduled send time: the occurrence generator subtracted the lead
 * minutes from the prescribed intake time when it created the row, so this is what the patient
 * was told to expect, not the dose time.
 */
export type ReminderEmailInput = {
  patient: EmailPatient;
  clinic: EmailClinic;
  title: string;
  body: string;
  dueAt: Date;
  /** Portal URL for the CTA. No token: an email must never carry a portal credential. */
  portalUrl: string;
};

export type EmailSendSummary = {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type BuiltEmail = {
  subject: string;
  html: string;
  text: string;
};

/** One provider event as the clinic reads it. */
export type EmailEventView = {
  id: string;
  kind: string;
  bounceType: string;
  message: string;
  email: string;
  occurredAt: string;
};

/**
 * A patient's email standing.
 *
 * The events travel with the state because the state alone is not actionable: "suppressed" is not
 * something a clinic can fix, whereas "mailbox does not exist, reported 3 August" is a phone call.
 */
export type EmailDeliveryView = {
  email: string;
  isSuppressed: boolean;
  reason: string;
  suppressedAt: string | null;
  softBounces: number;
  events: EmailEventView[];
};
