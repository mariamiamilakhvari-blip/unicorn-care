/**
 * The English half of the transactional email copy.
 *
 * Split per locale only because the two together run past the file-length limit — they are one
 * table, composed in `email-copy.const.ts`. Nothing else imports these directly.
 */
import { EmailCopy } from '@/shared/const/email-copy.types';
import { WARNING_SEVERITY_LABELS } from '@/shared/const/recovery.const';

export const EMAIL_COPY_EN: EmailCopy = {
  welcomeSubject: 'Your recovery plan',
  dailySubject: 'Your recovery today',
  greeting: 'Hello',
  procedure: 'Procedure',
  doctor: 'Doctor',
  medications: 'Medication schedule',
  dailyProcedures: 'Daily procedures',
  whatIsNormal: 'What is normal after surgery',
  whenToContact: 'When to contact the clinic',
  nextCheckup: 'Next checkup',
  todayMedications: "Today's medications",
  todayProcedures: "Today's procedures",
  daysUntilCheckup: 'Days until your checkup',
  daysUnit: 'days',
  today: 'today',
  noneToday: 'Nothing scheduled for today.',
  withFood: 'with food',
  withoutFood: 'on an empty stomach',
  dayRange: 'day',
  // The email says exactly what the patient's screen says. Written once, in the guide's own
  // vocabulary, so an inbox and the portal can never instruct the same person differently.
  severity: WARNING_SEVERITY_LABELS.en,
  footerNote: 'This email is from your clinic. Do not reply to this address.',
  questionsCall: 'Questions? Call',
  addressLabel: 'Address:',
  phoneLabel: 'Phone:',
  emailLabel: 'Email:',
  reminderSubject: 'Reminder',
  reminderDue: 'Due now',
  reminderAt: 'Scheduled for',
  openPortal: 'Open your portal',
  reportSubject: 'Your quarterly summary',
  reportHeadline: 'Quarterly impact summary',
  reportIntro: 'Here is how your recovery plans performed this quarter.',
  reportPatients: 'Patients',
  reportRemindersSent: 'Reminders delivered',
  reportAdherence: 'Tasks confirmed',
  reportHoursSaved: 'Estimated staff hours saved',
  reportHoursAssumption:
    'An estimate, not a measurement: {minutesPerReminder} minutes per delivered reminder and {minutesPerPatient} minutes per patient onboarded.',
  reportDelivery: 'Delivery',
  reportPush: 'Push notifications',
  reportEmail: 'Email',
  reportLanguages: 'Patient languages',
  reportNoData: 'Not recorded',
  reportInsights: 'What this means',
  reportMissed: '{count} reminders passed without an answer.',
  reportEstimateNote: 'Figures cover reminders scheduled between {from} and {to}.',
  symptomSubject: 'A patient reported a symptom',
  symptomHeadline: 'Symptom report awaiting review',
  symptomIntro: 'One of your patients has reported a symptom through their recovery portal.',
  symptomPatient: 'Patient',
  symptomFlagged: 'They selected',
  symptomOpenQueue: 'Open the review queue',
  symptomDetailWithheld:
    'What they wrote is not included in this email. Open the dashboard to read it.',
  symptomNotMonitored:
    'This is a notification, not monitoring. Unicorn Care does not watch for or assess ' +
    'symptoms, and nobody is alerted outside this message. A patient in danger must call ' +
    'emergency services.',
  resetSubject: 'Reset your password',
  resetHeadline: 'Reset your password',
  resetIntro: 'Someone asked to reset the password for this account. Use the button below to set a new one.',
  resetCta: 'Set a new password',
  resetExpiry: 'This link works once and stops working after {minutes} minutes.',
  resetIgnore:
    'If this was not you, ignore this email. Your password has not changed and nobody can ' +
    'change it without this link.',
  resetFooterNote: 'This email is from Unicorn Care. Do not reply to this address.',
  portalLinkSubject: 'Open your recovery plan',
  portalLinkHeadline: 'Open your recovery plan',
  portalLinkIntro:
    'Use the button below to open your recovery plan on this device. You will stay signed in ' +
    'afterwards, so you only need to do this once per device.',
  portalLinkCta: 'Open my plan',
  portalLinkExpiry: 'This link works once and stops working after {hours} hours.',
  portalLinkExpiryDays: 'This link works once and stops working after {days} days.',
  portalLinkActiveUntil:
    'This link is active throughout your recovery period (until {formattedEndDate}).',
  portalLinkIgnore:
    'If you did not ask for this, ignore this email. Nobody can open your plan without this link.',
};
