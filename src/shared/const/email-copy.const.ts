import { AppLocale } from '@/shared/types/roles';

/**
 * Every word that reaches a patient's inbox, in both languages.
 *
 * Kept out of `messages/*.json` on purpose: those are loaded by `next-intl` for a request with a
 * locale, and these emails are composed by a cron sweep that has no request. The patient's own
 * `locale` picks the column instead.
 */
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
  severity: Record<string, string>;
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
};

const EN: EmailCopy = {
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
  intensity: { light: 'Light', moderate: 'Moderate', intense: 'Intense' },
  withFood: 'with food',
  withoutFood: 'on an empty stomach',
  minutesShort: 'min',
  dayRange: 'day',
  severity: {
    monitor: 'Monitor',
    call_clinic: 'Call your clinic',
    urgent: 'Urgent — seek care now',
  },
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
};

const KA: EmailCopy = {
  welcomeSubject: 'თქვენი სარეაბილიტაციო გეგმა',
  dailySubject: 'თქვენი აღდგენა დღეს',
  greeting: 'გამარჯობა',
  procedure: 'პროცედურა',
  doctor: 'ექიმი',
  medications: 'მედიკამენტების განრიგი',
  dailyProcedures: 'ყოველდღიური პროცედურები',
  whatIsNormal: 'რა არის ნორმა ოპერაციის შემდეგ',
  whenToContact: 'როდის დაუკავშირდეთ კლინიკას',
  nextCheckup: 'შემდეგი კონტროლი',
  todayMedications: 'დღევანდელი მედიკამენტები',
  todayProcedures: 'დღევანდელი პროცედურები',
  daysUntilCheckup: 'დღე კონტროლის ვიზიტამდე',
  daysUnit: 'დღე',
  today: 'დღეს',
  noneToday: 'დღეს დაგეგმილი არაფერია.',
  intensity: { light: 'მსუბუქი', moderate: 'საშუალო', intense: 'ინტენსიური' },
  withFood: 'საკვებთან ერთად',
  withoutFood: 'ცარიელ კუჭზე',
  minutesShort: 'წთ',
  dayRange: 'დღე',
  severity: {
    monitor: 'დააკვირდით',
    call_clinic: 'დაურეკეთ კლინიკას',
    urgent: 'გადაუდებელი — დაუყოვნებლივ მიმართეთ ექიმს',
  },
  footerNote: 'ეს წერილი გამოგზავნილია თქვენი კლინიკის მიერ. გთხოვთ, არ უპასუხოთ ამ მისამართს.',
  questionsCall: 'კითხვები? დარეკეთ',
  addressLabel: 'მისამართი:',
  phoneLabel: 'ტელეფონი:',
  emailLabel: 'ელფოსტა:',
  reminderSubject: 'შეხსენება',
  reminderDue: 'დროა',
  reminderAt: 'დაგეგმილია',
  openPortal: 'გახსენით თქვენი პორტალი',
  reportSubject: 'თქვენი კვარტალური შეჯამება',
  reportHeadline: 'კვარტალური შედეგების შეჯამება',
  reportIntro: 'ასე იმუშავა თქვენმა სარეაბილიტაციო გეგმებმა ამ კვარტალში.',
  reportPatients: 'პაციენტები',
  reportRemindersSent: 'მიწოდებული შეხსენებები',
  reportAdherence: 'დადასტურებული დავალებები',
  reportHoursSaved: 'დაზოგილი სამუშაო საათები (შეფასება)',
  reportHoursAssumption:
    'ეს შეფასებაა და არა გაზომვა: {minutesPerReminder} წუთი თითო მიწოდებულ შეხსენებაზე და {minutesPerPatient} წუთი თითო ახალ პაციენტზე.',
  reportDelivery: 'მიწოდება',
  reportPush: 'Push-შეტყობინებები',
  reportEmail: 'ელფოსტა',
  reportLanguages: 'პაციენტების ენები',
  reportNoData: 'არ არის აღრიცხული',
  reportInsights: 'რას ნიშნავს ეს',
  reportMissed: '{count} შეხსენება უპასუხოდ დარჩა.',
  reportEstimateNote: 'მონაცემები მოიცავს {from} — {to} პერიოდში დაგეგმილ შეხსენებებს.',
  symptomSubject: 'პაციენტმა სიმპტომი დააფიქსირა',
  symptomHeadline: 'სიმპტომის შეტყობინება ელოდება განხილვას',
  symptomIntro: 'თქვენმა ერთ-ერთმა პაციენტმა პორტალიდან დააფიქსირა სიმპტომი.',
  symptomPatient: 'პაციენტი',
  symptomFlagged: 'მან აირჩია',
  symptomOpenQueue: 'გახსენით განსახილველი სია',
  symptomDetailWithheld:
    'რაც მან დაწერა, ამ წერილში არ არის. დეტალების სანახავად გახსენით დაფა.',
  symptomNotMonitored:
    'ეს არის შეტყობინება და არა მონიტორინგი. Unicorn Care არ აკვირდება და არ აფასებს ' +
    'სიმპტომებს, და ამ წერილის გარდა არავის ეცნობება. საფრთხის შემთხვევაში პაციენტმა ' +
    'უნდა დარეკოს გადაუდებელი დახმარების სამსახურში.',
};

export function emailCopy(locale: AppLocale): EmailCopy {
  return locale === 'en' ? EN : KA;
}
