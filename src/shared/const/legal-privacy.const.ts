/** The Privacy Policy, in both locales. Split from `legal.const.ts` to keep each file readable. */
import { LEGAL_CONTACT_EMAIL } from '@/shared/const/legal-contact.const';
import { LegalDocument } from '@/shared/const/legal.types';
import { AppLocale } from '@/shared/types/roles';

export const LEGAL_PRIVACY: Record<AppLocale, LegalDocument> = {
  en: {
    title: 'Privacy Policy',
    intro:
      'This policy explains what Unicorn Care stores, why, and who else touches it. It covers both ' +
      'the clinic staff who hold accounts and the patients whose recovery a clinic manages here.',
    sections: [
      {
        heading: 'Who controls the data',
        paragraphs: [
          'For patient data the clinic is the controller and Unicorn Care is the processor: we ' +
            'store and process it on the clinic’s instructions, to run the care plans it builds.',
          'For clinic account data — the owner’s name, email, and billing details — we are the ' +
            'controller.',
        ],
      },
      {
        heading: 'What we store',
        paragraphs: [
          'Clinic accounts: name, email address, a hashed password, role, clinic name and address, ' +
            'time zone, and any tax or registration number supplied for invoicing.',
          'Patients: name, contact details, date of birth, sex, allergies and notes, plus the ' +
            'procedures, medications, rehabilitation tasks and checkups making up their plan, and ' +
            'the symptom reports they submit. Some of this is health data and is treated as a ' +
            'special category.',
          'Consents: the version of the wording accepted and the moment it was accepted. The ' +
            'individual answers are not stored, because none of the boxes are optional.',
        ],
      },
      {
        heading: 'Why we store it',
        paragraphs: [
          'To run the service the clinic signed up for: holding the care plan, generating the ' +
            'reminder schedule, sending those reminders, and showing the clinic whether they were ' +
            'acted on.',
          'Patient information is not used for advertising, is not sold, and is not used to train ' +
            'anyone’s models.',
        ],
      },
      {
        heading: 'Who else processes it',
        paragraphs: [
          'MongoDB Atlas hosts the database. Vercel hosts and runs the application. Resend delivers ' +
            'patient email. Our payment provider handles checkout and invoicing — card details ' +
            'reach them directly and never touch our servers.',
          'The optional post-operative assistant sends the question asked and the relevant plan ' +
            'context to an external model provider to produce an answer.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Patient records live as long as the clinic keeps them. A clinic can archive or delete a ' +
            'patient at any time.',
          'Deleting a clinic account erases its patients, care plans and reminders, and cancels the ' +
            'subscription. Deletion is immediate and cannot be reversed.',
          'Patient portal access links expire, and a clinic can revoke one at any time.',
        ],
      },
      {
        heading: 'Rights, and how to use them',
        paragraphs: [
          'A patient may ask for access to their data, correction of it, deletion, restriction of ' +
            'processing, or a copy of it. The first stop is the clinic that treated them, since the ' +
            'clinic is the controller of that record.',
          `Anything we can help with directly reaches us at ${LEGAL_CONTACT_EMAIL}. Where a ` +
            'supervisory authority has jurisdiction, a complaint may also be made to it.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'Passwords are stored hashed, never in the clear. Patient portal links are opaque, ' +
            'expiring tokens rather than guessable URLs, and the portal is excluded from search ' +
            'engine indexing.',
          'No system is perfect. If a breach affects clinic or patient data we will notify the ' +
            'clinics concerned without undue delay.',
        ],
      },
    ],
  },
  ka: {
    title: 'კონფიდენციალურობის პოლიტიკა',
    intro:
      'ეს პოლიტიკა განმარტავს, რას ინახავს Unicorn Care, რატომ და ვის აქვს მასზე წვდომა. ის ' +
      'ეხება როგორც კლინიკის თანამშრომლებს, რომლებსაც ანგარიშები აქვთ, ისე პაციენტებს, რომელთა ' +
      'რეაბილიტაციასაც კლინიკა აქ მართავს.',
    sections: [
      {
        heading: 'ვინ აკონტროლებს მონაცემებს',
        paragraphs: [
          'პაციენტის მონაცემებზე კლინიკა არის კონტროლიორი, ხოლო Unicorn Care — დამმუშავებელი: ' +
            'ჩვენ ვინახავთ და ვამუშავებთ მათ კლინიკის მითითებით, მის მიერ შედგენილი გეგმების ' +
            'შესასრულებლად.',
          'კლინიკის ანგარიშის მონაცემებზე — მფლობელის სახელი, ელფოსტა და საგადახდო დეტალები — ' +
            'კონტროლიორები ჩვენ ვართ.',
        ],
      },
      {
        heading: 'რას ვინახავთ',
        paragraphs: [
          'კლინიკის ანგარიშები: სახელი, ელფოსტა, დაშიფრული პაროლი, როლი, კლინიკის დასახელება და ' +
            'მისამართი, დროის სარტყელი და ინვოისისთვის მითითებული საიდენტიფიკაციო ნომერი.',
          'პაციენტები: სახელი, საკონტაქტო მონაცემები, დაბადების თარიღი, სქესი, ალერგიები და ' +
            'შენიშვნები, ასევე პროცედურები, მედიკამენტები, სარეაბილიტაციო დავალებები და ' +
            'საკონტროლო ვიზიტები, რომლებიც ქმნის მათ გეგმას, და მათ მიერ გაგზავნილი სიმპტომების ' +
            'ანგარიშები. ნაწილი ამ ინფორმაციისა ჯანმრთელობის მონაცემია და განიხილება ' +
            'განსაკუთრებული კატეგორიის მონაცემად.',
          'თანხმობები: მიღებული ტექსტის ვერსია და მიღების მომენტი. ცალკეული პასუხები არ ინახება, ' +
            'რადგან არცერთი ველი არ არის არასავალდებულო.',
        ],
      },
      {
        heading: 'რატომ ვინახავთ',
        paragraphs: [
          'იმ სერვისის შესასრულებლად, რომელზეც კლინიკა დარეგისტრირდა: სამკურნალო გეგმის ' +
            'შენახვა, შეხსენებების განრიგის შედგენა, მათი გაგზავნა და კლინიკისთვის იმის ჩვენება, ' +
            'შესრულდა თუ არა ისინი.',
          'პაციენტის ინფორმაცია არ გამოიყენება რეკლამისთვის, არ იყიდება და არ გამოიყენება ' +
            'რომელიმე მოდელის სასწავლებლად.',
        ],
      },
      {
        heading: 'ვინ სხვა ამუშავებს',
        paragraphs: [
          'MongoDB Atlas მასპინძლობს ბაზას. Vercel მასპინძლობს და ამუშავებს აპლიკაციას. Resend ' +
            'აწვდის პაციენტის ელფოსტას. გადახდის პროვაიდერი უზრუნველყოფს ანგარიშსწორებას და ' +
            'ინვოისებს — ბარათის მონაცემები პირდაპირ მას მიდის და ჩვენს სერვერს არ ეხება.',
          'არასავალდებულო პოსტოპერაციული ასისტენტი გზავნის დასმულ შეკითხვას და გეგმის შესაბამის ' +
            'კონტექსტს გარე მოდელის პროვაიდერთან პასუხის მისაღებად.',
        ],
      },
      {
        heading: 'რამდენ ხანს ვინახავთ',
        paragraphs: [
          'პაციენტის ჩანაწერები ინახება მანამ, სანამ კლინიკა ინახავს მათ. კლინიკას ნებისმიერ ' +
            'დროს შეუძლია პაციენტის დაარქივება ან წაშლა.',
          'კლინიკის ანგარიშის წაშლა შლის მის პაციენტებს, სამკურნალო გეგმებსა და შეხსენებებს და ' +
            'აუქმებს გამოწერას. წაშლა დაუყოვნებლივია და შეუქცევადი.',
          'პაციენტის პორტალის ბმულებს ვადა აქვთ, და კლინიკას ნებისმიერ დროს შეუძლია მათი გაუქმება.',
        ],
      },
      {
        heading: 'უფლებები და მათი გამოყენება',
        paragraphs: [
          'პაციენტს შეუძლია მოითხოვოს თავის მონაცემებზე წვდომა, მათი გასწორება, წაშლა, ' +
            'დამუშავების შეზღუდვა ან ასლი. პირველი მიმართვა უნდა იყოს იმ კლინიკასთან, რომელმაც ' +
            'მკურნალობა ჩაუტარა, რადგან სწორედ კლინიკაა ამ ჩანაწერის კონტროლიორი.',
          `ყველაფერი, რაშიც ჩვენ პირდაპირ შეგვიძლია დახმარება, მოგვწერეთ: ${LEGAL_CONTACT_EMAIL}. ` +
            'სადაც საზედამხედველო ორგანოს იურისდიქცია ვრცელდება, საჩივრის შეტანა მასთანაც შეიძლება.',
        ],
      },
      {
        heading: 'უსაფრთხოება',
        paragraphs: [
          'პაროლები ინახება დაშიფრულად, არასოდეს ღია სახით. პაციენტის პორტალის ბმულები არის ' +
            'გაუმჭვირვალე, ვადიანი ტოკენები და არა გამოსაცნობი მისამართები, ხოლო პორტალი ' +
            'გამორიცხულია საძიებო სისტემების ინდექსირებიდან.',
          'იდეალური სისტემა არ არსებობს. თუ დარღვევა შეეხება კლინიკის ან პაციენტის მონაცემებს, ' +
            'დაზარალებულ კლინიკებს დაუყოვნებლივ ვაცნობებთ.',
        ],
      },
    ],
  },
};
