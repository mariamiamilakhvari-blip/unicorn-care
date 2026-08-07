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
};

export function emailCopy(locale: AppLocale): EmailCopy {
  return locale === 'en' ? EN : KA;
}
