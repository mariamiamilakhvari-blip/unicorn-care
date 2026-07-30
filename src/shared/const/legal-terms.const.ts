/** The Terms of Service, in both locales. Split from `legal.const.ts` to keep each file readable. */
import { LegalDocument } from '@/shared/const/legal.types';
import { AppLocale } from '@/shared/types/roles';

export const TERMS: Record<AppLocale, LegalDocument> = {
  en: {
    title: 'Terms of Service',
    intro:
      'These terms govern a clinic’s use of Unicorn Care, a platform for managing post-operative ' +
      'care plans and sending reminders to patients. By creating a clinic account you accept them.',
    sections: [
      {
        heading: 'What the service does',
        paragraphs: [
          'Unicorn Care lets a clinic record patients, procedures and recovery plans, and sends ' +
            'the resulting reminders to patients by email at the times the clinic schedules.',
          'The service is an administrative tool. It does not diagnose, does not treat, and does ' +
            'not decide anything clinical. Every clinical judgement remains the clinic’s.',
        ],
      },
      {
        heading: 'Not medical advice, not an emergency service',
        paragraphs: [
          'Reminders and any assistant responses support a plan the clinic authored. They are not ' +
            'professional medical advice and they do not replace consultation with a clinician.',
          'The service is not monitored in real time and must never be relied on in an emergency. ' +
            'A patient who needs urgent care must contact emergency services or their clinic.',
        ],
      },
      {
        heading: 'The clinic’s responsibilities',
        paragraphs: [
          'The clinic is the controller of the patient data it enters and is responsible for ' +
            'holding a lawful basis for it, including explicit consent for health data where that ' +
            'is what applies. Unicorn Care processes that data on the clinic’s instructions.',
          'The clinic is responsible for the accuracy of what it enters, for correcting it when ' +
            'it learns it is wrong, and for the confidentiality of its account credentials. ' +
            'Accounts must not be shared.',
          'The clinic is responsible for complying with the privacy and healthcare rules of its ' +
            'own jurisdiction.',
        ],
      },
      {
        heading: 'Plans, billing and trials',
        paragraphs: [
          'Every clinic starts on a time-limited free trial. Paid plans are billed in advance ' +
            'through our payment provider, monthly or annually, and renew until cancelled.',
          'Cancelling stops future billing. It does not refund the period already paid for, ' +
            'unless the law of the clinic’s jurisdiction requires otherwise.',
          'Where a clinic supplies a tax or VAT registration number, it appears on the invoice ' +
            'issued by our payment provider.',
        ],
      },
      {
        heading: 'Ending the agreement',
        paragraphs: [
          'A clinic may delete its account at any time from the dashboard. Deletion cancels the ' +
            'subscription and erases the clinic’s patients, plans and reminders. It cannot be undone.',
          'We may suspend an account that is being used unlawfully, or that puts patient data at ' +
            'risk. Where circumstances allow, we will say why first.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'The service is provided as it stands. We do not warrant that reminder delivery is ' +
            'uninterrupted — email depends on providers outside our control — and a clinic must ' +
            'not design a care pathway that fails unsafely if a message is late or missed.',
          'Nothing here limits liability that cannot lawfully be limited.',
        ],
      },
    ],
  },
  ka: {
    title: 'მომსახურების პირობები',
    intro:
      'ეს პირობები არეგულირებს კლინიკის მიერ Unicorn Care-ის გამოყენებას — პლატფორმისა, რომელიც ' +
      'ემსახურება ოპერაციის შემდგომი მოვლის გეგმების მართვას და პაციენტებისთვის შეხსენებების ' +
      'გაგზავნას. კლინიკის ანგარიშის შექმნით თქვენ ეთანხმებით მათ.',
    sections: [
      {
        heading: 'რას აკეთებს სერვისი',
        paragraphs: [
          'Unicorn Care საშუალებას აძლევს კლინიკას აღრიცხოს პაციენტები, პროცედურები და ' +
            'სარეაბილიტაციო გეგმები, და გაუგზავნოს პაციენტს შესაბამისი შეხსენებები ელფოსტით იმ ' +
            'დროს, რომელსაც კლინიკა განსაზღვრავს.',
          'სერვისი ადმინისტრაციული ინსტრუმენტია. ის არ სვამს დიაგნოზს, არ მკურნალობს და არ იღებს ' +
            'არანაირ კლინიკურ გადაწყვეტილებას. ყველა კლინიკური მსჯელობა რჩება კლინიკის პასუხისმგებლობად.',
        ],
      },
      {
        heading: 'არ არის სამედიცინო რჩევა და არც გადაუდებელი დახმარება',
        paragraphs: [
          'შეხსენებები და ასისტენტის პასუხები მხარს უჭერს კლინიკის მიერ შედგენილ გეგმას. ისინი არ ' +
            'არის პროფესიული სამედიცინო რჩევა და არ ცვლის ექიმთან კონსულტაციას.',
          'სერვისი რეალურ დროში არ კონტროლდება და მასზე დაყრდნობა გადაუდებელ სიტუაციაში ' +
            'დაუშვებელია. პაციენტმა, რომელსაც სასწრაფო დახმარება სჭირდება, უნდა დაუკავშირდეს ' +
            'გადაუდებელ სამსახურს ან თავის კლინიკას.',
        ],
      },
      {
        heading: 'კლინიკის პასუხისმგებლობა',
        paragraphs: [
          'კლინიკა არის მის მიერ შეტანილი პაციენტის მონაცემების კონტროლიორი და პასუხისმგებელია ' +
            'კანონიერ საფუძველზე, მათ შორის ჯანმრთელობის მონაცემებზე მკაფიო თანხმობაზე, სადაც ეს ' +
            'მოთხოვნილია. Unicorn Care ამუშავებს ამ მონაცემებს კლინიკის მითითებით.',
          'კლინიკა პასუხისმგებელია შეტანილი ინფორმაციის სისწორეზე, მის გასწორებაზე შეცდომის ' +
            'აღმოჩენისთანავე, და თავისი ანგარიშის წვდომის მონაცემების კონფიდენციალურობაზე. ' +
            'ანგარიშების გაზიარება დაუშვებელია.',
          'კლინიკა პასუხისმგებელია თავისი იურისდიქციის კონფიდენციალურობისა და ჯანდაცვის ' +
            'რეგულაციების დაცვაზე.',
        ],
      },
      {
        heading: 'პაკეტები, გადახდა და საცდელი პერიოდი',
        paragraphs: [
          'ყოველი კლინიკა იწყებს შეზღუდული ვადის უფასო საცდელი პერიოდით. ფასიანი პაკეტები ' +
            'გადაიხდება წინასწარ, ჩვენი გადახდის პროვაიდერის მეშვეობით, თვიურად ან წლიურად, და ' +
            'განახლდება გაუქმებამდე.',
          'გაუქმება აჩერებს მომავალ გადახდებს. ის არ აბრუნებს უკვე გადახდილ პერიოდს, თუ კლინიკის ' +
            'იურისდიქციის კანონმდებლობა სხვას არ ითხოვს.',
          'თუ კლინიკა მიუთითებს საიდენტიფიკაციო ან დღგ-ის ნომერს, ის აისახება გადახდის ' +
            'პროვაიდერის მიერ გამოწერილ ინვოისზე.',
        ],
      },
      {
        heading: 'ხელშეკრულების დასრულება',
        paragraphs: [
          'კლინიკას ნებისმიერ დროს შეუძლია წაშალოს ანგარიში დაფიდან. წაშლა აუქმებს გამოწერას და ' +
            'შლის კლინიკის პაციენტებს, გეგმებსა და შეხსენებებს. მოქმედება შეუქცევადია.',
          'ჩვენ შეგვიძლია შევაჩეროთ ანგარიში, რომელიც გამოიყენება უკანონოდ ან საფრთხეს უქმნის ' +
            'პაციენტის მონაცემებს. სადაც გარემოებები იძლევა საშუალებას, წინასწარ განვმარტავთ მიზეზს.',
        ],
      },
      {
        heading: 'პასუხისმგებლობის შეზღუდვა',
        paragraphs: [
          'სერვისი მოწოდებულია არსებული სახით. ჩვენ არ ვიძლევით გარანტიას შეხსენებების ' +
            'უწყვეტ მიწოდებაზე — ელფოსტა დამოკიდებულია ჩვენს კონტროლს მიღმა მყოფ პროვაიდერებზე — ' +
            'და კლინიკამ არ უნდა ააგოს ისეთი სამკურნალო პროცესი, რომელიც საშიშად იშლება ' +
            'შეტყობინების დაგვიანების ან გამოტოვების შემთხვევაში.',
          'აქ არაფერი ზღუდავს პასუხისმგებლობას, რომლის შეზღუდვაც კანონით დაუშვებელია.',
        ],
      },
    ],
  },
};
