import { FeaturePage } from '@/shared/const/feature-page.types';

export const SURGERY_RECOVERY_PAGE: FeaturePage = {
  slug: 'surgery-recovery-management',
  content: {
    en: {
      title: 'Surgery Recovery Management Software | Unicorn Care',
      description:
        'Surgery recovery management for plastic surgery clinics: one rehabilitation programme ' +
        'per procedure, covering medication, tasks, checkups and complications.',
      heading: 'Surgery recovery management, one plan per procedure',
      lead:
        'Recovery is the part of a plastic procedure that happens where the clinic cannot see. ' +
        'A rehabilitation programme built once per procedure turns it into something the clinic ' +
        'can run rather than hope for.',
      sections: [
        {
          heading: 'The procedure on record',
          body:
            'Who performed the plastic surgery, what manipulation was carried out and on what ' +
            'date — recorded against the patient, and the anchor every recovery day is counted ' +
            'from.',
        },
        {
          heading: 'A rehabilitation programme with intensity',
          body:
            'Rehabilitation tasks carry their intensity, duration, days of the week and times of ' +
            'day, so a patient is told what to do and how hard, not simply to rest.',
        },
        {
          heading: 'A defined end',
          body:
            'The plan states when rehabilitation ends and when the patient is due back. Both are ' +
            'reminders, so neither depends on someone at the clinic remembering.',
        },
      ],
      ctaLabel: 'Set up your clinic',
    },
    ka: {
      title: 'ქირურგიული აღდგენის მართვის პროგრამა | Unicorn Care',
      description:
        'პლასტიკური ქირურგიის პროცედურების რეაბილიტაციის პროგრამა: ერთი გეგმა თითოეულ ' +
        'პროცედურაზე — მედიკამენტები, პროცედურები, კონტროლი და გართულებები.',
      heading: 'ქირურგიული აღდგენის მართვა — ერთი გეგმა თითო პროცედურაზე',
      lead:
        'აღდგენა მიმდინარეობს იქ, სადაც კლინიკა ვერ ხედავს. სარეაბილიტაციო გეგმა, რომელიც ' +
        'ერთხელ იქმნება პროცედურაზე, აქცევს ამ პერიოდს მართვად პროცესად.',
      sections: [
        {
          heading: 'პროცედურა ჩანაწერში',
          body:
            'ვინ ჩაატარა პლასტიკური ოპერაცია, რა მანიპულაცია შესრულდა და რომელ თარიღში — ' +
            'ეს არის წერტილი, საიდანაც აითვლება აღდგენის ყოველი დღე.',
        },
        {
          heading: 'რეაბილიტაცია ინტენსივობით',
          body:
            'პროცედურებს აქვს ინტენსივობა, ხანგრძლივობა, კვირის დღეები და საათები — პაციენტმა ' +
            'იცის, რა გააკეთოს და რა დატვირთვით.',
        },
        {
          heading: 'განსაზღვრული დასასრული',
          body:
            'გეგმა აფიქსირებს, როდის სრულდება რეაბილიტაცია და როდის უნდა მოვიდეს პაციენტი ' +
            'კონტროლზე. ორივე შეხსენებაა და არავის მეხსიერებაზე არ არის დამოკიდებული.',
        },
      ],
      ctaLabel: 'დაარეგისტრირეთ კლინიკა',
    },
  },
};
