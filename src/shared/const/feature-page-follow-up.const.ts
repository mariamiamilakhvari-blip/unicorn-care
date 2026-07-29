import { FeaturePage } from '@/shared/const/feature-page.types';

export const PATIENT_FOLLOW_UP_PAGE: FeaturePage = {
  slug: 'patient-follow-up',
  content: {
    en: {
      title: 'Patient Follow-Up Software for Clinics | Unicorn Care',
      description:
        'Patient follow-up software: checkup reminders, adherence tracking and post-operative ' +
        'monitoring for plastic surgery clinics.',
      heading: 'Patient follow-up that does not depend on phone calls',
      lead:
        'Follow-up usually means someone at the clinic remembering to ring. This turns it into ' +
        'something the system does, and reports on.',
      sections: [
        {
          heading: 'Checkup reminders ahead of time',
          body:
            'Each checkup carries its own lead time in hours, so the patient is reminded far ' +
            'enough ahead to rearrange their day rather than the morning of.',
        },
        {
          heading: 'Adherence a clinic can see',
          body:
            'Completed, skipped and missed reminders are counted per plan and bucketed by day, ' +
            'so the clinic can see how recovery is going over time instead of asking.',
        },
        {
          heading: 'Patient management in one roster',
          body:
            'Patients, their procedures, their doctors and their plans sit in one place, with ' +
            'archived patients kept as history rather than deleted.',
        },
      ],
      ctaLabel: 'Set up your clinic',
    },
    ka: {
      title: 'პაციენტის მეთვალყურეობის პროგრამა კლინიკებისთვის | Unicorn Care',
      description:
        'პაციენტების მართვის პროგრამა: კონტროლის ვიზიტის შეხსენებები, გეგმის შესრულების ' +
        'მონიტორინგი და ოპერაციის შემდგომი მეთვალყურეობა.',
      heading: 'პაციენტის მეთვალყურეობა ზარებზე დამოკიდებულების გარეშე',
      lead:
        'მეთვალყურეობა ჩვეულებრივ ნიშნავს, რომ კლინიკაში ვიღაცას უნდა გაახსენდეს დარეკვა. ' +
        'აქ ამას სისტემა აკეთებს და შედეგსაც აჩვენებს.',
      sections: [
        {
          heading: 'კონტროლის ვიზიტის შეხსენება წინასწარ',
          body:
            'თითოეულ კონტროლის ვიზიტს აქვს საკუთარი წინსწრება საათებში, რომ პაციენტმა ' +
            'მოასწროს დღის გადაწყობა და არა მხოლოდ ვიზიტის დილას შეიტყოს.',
        },
        {
          heading: 'გეგმის შესრულება ხილულია',
          body:
            'შესრულებული, გამოტოვებული და გაცდენილი შეხსენებები ითვლება გეგმის მიხედვით და ' +
            'ნაწილდება დღეებად — ჩანს, როგორ მიმდინარეობს აღდგენა დროში.',
        },
        {
          heading: 'პაციენტების ერთიანი სია',
          body:
            'პაციენტები, მათი პროცედურები, ექიმები და გეგმები ერთ ადგილას; დაარქივებული ' +
            'პაციენტი რჩება ისტორიად და არ იშლება.',
        },
      ],
      ctaLabel: 'დაარეგისტრირეთ კლინიკა',
    },
  },
};
