import { FeaturePage } from '@/shared/const/feature-page.types';

export const PATIENT_PORTAL_PAGE: FeaturePage = {
  slug: 'patient-portal',
  content: {
    en: {
      title: 'Patient Portal for Plastic Surgery Clinics | Unicorn Care',
      description:
        'A private patient portal showing the recovery plan, what is normal on each day and ' +
        'when to contact the clinic. No app to install.',
      heading: 'A patient portal for post-operative recovery',
      lead:
        'Patients leave the clinic with instructions they will not remember by day three. The ' +
        'portal gives them one private page that always shows what today requires and what to ' +
        'expect next.',
      sections: [
        {
          heading: 'Today, not a leaflet',
          body:
            'The portal shows the doses and rehabilitation tasks due today with their times, and ' +
            'the next checkup with a countdown, rather than a static document to search through.',
        },
        {
          heading: 'Normal versus complication',
          body:
            'The clinic writes, per procedure type, what is expected on which recovery day and ' +
            'which signs mean the patient should call. The patient reads it in their own language.',
        },
        {
          heading: 'No installation, no password',
          body:
            'The portal opens from a private link and can be added to a phone’s home screen. ' +
            'Because that link is private, the portal is never indexed by search engines.',
        },
      ],
      ctaLabel: 'Set up your clinic',
    },
    ka: {
      title: 'პაციენტის პორტალი პლასტიკური ქირურგიის კლინიკებისთვის | Unicorn Care',
      description:
        'პირადი პაციენტის პორტალი სარეაბილიტაციო გეგმით: რა არის ნორმა თითოეულ დღეს და როდის ' +
        'უნდა დაუკავშირდეს პაციენტი კლინიკას. აპლიკაცია საჭირო არ არის.',
      heading: 'პაციენტის პორტალი ოპერაციის შემდგომი აღდგენისთვის',
      lead:
        'პაციენტი კლინიკიდან გადის ინსტრუქციებით, რომლებიც მესამე დღეს აღარ ახსოვს. პორტალი ' +
        'აძლევს ერთ პირად გვერდს, სადაც ყოველთვის წერია, რას მოითხოვს დღევანდელი დღე.',
      sections: [
        {
          heading: 'დღევანდელი დღე, და არა ბუკლეტი',
          body:
            'პორტალი აჩვენებს დღეს დასალევ დოზებსა და პროცედურებს დროებთან ერთად, ასევე ' +
            'შემდეგ კონტროლის ვიზიტს დარჩენილი დღეების ათვლით.',
        },
        {
          heading: 'ნორმა და გართულება',
          body:
            'კლინიკა თითოეული პროცედურის ტიპისთვის წერს, რა არის მოსალოდნელი რომელ დღეს და ' +
            'რომელი ნიშნის დროს უნდა დარეკოს პაციენტმა. პაციენტი კითხულობს თავის ენაზე.',
        },
        {
          heading: 'უაპლიკაციოდ და უპაროლოდ',
          body:
            'პორტალი იხსნება პირადი ბმულით და შეიძლება დაემატოს ტელეფონის მთავარ ეკრანზე. ' +
            'რადგან ბმული პირადია, პორტალი არასდროს ხვდება საძიებო სისტემებში.',
        },
      ],
      ctaLabel: 'დაარეგისტრირეთ კლინიკა',
    },
  },
};
