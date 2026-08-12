/**
 * The shape of every word that reaches an inbox.
 *
 * Kept out of `messages/*.json` on purpose: those are loaded by `next-intl` for a request with a
 * locale, and these emails are composed by a cron sweep that has no request. The recipient's own
 * `locale` picks the column instead.
 *
 * The two filled-in tables live in `email-copy-en.const.ts` and `email-copy-ka.const.ts`, and
 * `email-copy.const.ts` is what callers reach for.
 */
import { WarningSeverity } from '@/shared/const/recovery.const';

export type EmailCopy = {
  welcomeSubject: string;
  dailySubject: string;
  greeting: string;
  procedure: string;
  doctor: string;
  medications: string;
  dailyProcedures: string;
  whatIsNormal: string;
  whenToContact: string;
  nextCheckup: string;
  todayMedications: string;
  todayProcedures: string;
  daysUntilCheckup: string;
  daysUnit: string;
  today: string;
  noneToday: string;
  intensity: Record<'light' | 'moderate' | 'intense', string>;
  withFood: string;
  withoutFood: string;
  minutesShort: string;
  dayRange: string;
  /** Keyed by the schema enum, so a new severity cannot be added without wording for the inbox. */
  severity: Record<WarningSeverity, string>;
  footerNote: string;
  questionsCall: string;
  /* Footer labels. Each line is omitted whole when the clinic has not filled the field in. */
  addressLabel: string;
  phoneLabel: string;
  emailLabel: string;
  /* The timed reminder: one message about one dose or task, at the moment it is due. */
  reminderSubject: string;
  reminderDue: string;
  reminderAt: string;
  openPortal: string;
  /* The quarterly impact summary. */
  reportSubject: string;
  reportHeadline: string;
  reportIntro: string;
  reportPatients: string;
  reportRemindersSent: string;
  reportAdherence: string;
  reportHoursSaved: string;
  reportHoursAssumption: string;
  reportDelivery: string;
  reportPush: string;
  reportEmail: string;
  reportLanguages: string;
  reportNoData: string;
  reportInsights: string;
  reportMissed: string;
  reportEstimateNote: string;
  /* The clinic-facing alert when a patient files a symptom report. */
  symptomSubject: string;
  symptomHeadline: string;
  symptomIntro: string;
  symptomPatient: string;
  symptomFlagged: string;
  symptomOpenQueue: string;
  symptomDetailWithheld: string;
  symptomNotMonitored: string;
  /*
    The password reset link. The only email in this file the platform sends about itself rather
    than on a clinic's behalf, which is why it carries its own footer note — the standard one says
    the message came from your clinic, and here it did not.
  */
  resetSubject: string;
  resetHeadline: string;
  resetIntro: string;
  resetCta: string;
  resetExpiry: string;
  resetIgnore: string;
  resetFooterNote: string;
  /*
    The link a patient asks for when the portal no longer opens on their device. Sent by the
    clinic, so it keeps the standard footer — unlike the reset above.
  */
  portalLinkSubject: string;
  portalLinkHeadline: string;
  portalLinkIntro: string;
  portalLinkCta: string;
  portalLinkExpiry: string;
  portalLinkIgnore: string;
};
