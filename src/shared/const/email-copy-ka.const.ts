/**
 * The Georgian half of the transactional email copy.
 *
 * Split per locale only because the two together run past the file-length limit — they are one
 * table, composed in `email-copy.const.ts`. Nothing else imports these directly.
 */
import { EmailCopy } from '@/shared/const/email-copy.types';
import { WARNING_SEVERITY_LABELS } from '@/shared/const/recovery.const';

export const EMAIL_COPY_KA: EmailCopy = {
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
  withFood: 'საკვებთან ერთად',
  withoutFood: 'ცარიელ კუჭზე',
  dayRange: 'დღე',
  // Same wording as the patient's screen — see the English table for why.
  severity: WARNING_SEVERITY_LABELS.ka,
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
  resetSubject: 'პაროლის აღდგენა',
  resetHeadline: 'პაროლის აღდგენა',
  resetIntro: 'მოთხოვნილია ამ ანგარიშის პაროლის აღდგენა. ახალი პაროლის დასაყენებლად გამოიყენეთ ქვემოთ მოცემული ღილაკი.',
  resetCta: 'ახალი პაროლის დაყენება',
  resetExpiry: 'ეს ბმული მუშაობს ერთხელ და ძალას კარგავს {minutes} წუთში.',
  resetIgnore:
    'თუ ეს თქვენ არ ყოფილხართ, უგულებელყავით ეს წერილი. თქვენი პაროლი არ შეცვლილა და ამ ' +
    'ბმულის გარეშე მისი შეცვლა შეუძლებელია.',
  resetFooterNote: 'ეს წერილი გამოგზავნილია Unicorn Care-ის მიერ. გთხოვთ, არ უპასუხოთ ამ მისამართს.',
  portalLinkSubject: 'გახსენით თქვენი აღდგენის გეგმა',
  portalLinkHeadline: 'გახსენით თქვენი აღდგენის გეგმა',
  portalLinkIntro:
    'ამ მოწყობილობაზე გეგმის გასახსნელად გამოიყენეთ ქვემოთ მოცემული ღილაკი. ამის შემდეგ ' +
    'სისტემაში დარჩებით შესული, ამიტომ ეს ერთხელ არის საჭირო თითოეულ მოწყობილობაზე.',
  portalLinkCta: 'გეგმის გახსნა',
  portalLinkExpiry: 'ეს ბმული მუშაობს ერთხელ და ძალას კარგავს {hours} საათში.',
  portalLinkIgnore:
    'თუ ეს თქვენ არ მოგითხოვიათ, უგულებელყავით ეს წერილი. ამ ბმულის გარეშე თქვენი გეგმის ' +
    'გახსნა შეუძლებელია.',
};
