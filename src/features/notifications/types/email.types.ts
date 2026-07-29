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

export type EmailClinic = {
  name: string;
  phone: string;
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
