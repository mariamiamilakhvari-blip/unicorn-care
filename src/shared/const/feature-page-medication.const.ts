import { FeaturePage } from '@/shared/const/feature-page.types';

export const MEDICATION_REMINDERS_PAGE: FeaturePage = {
  slug: 'medication-reminders',
  content: {
    en: {
      title: 'Medication Reminder Software for Clinics | Unicorn Care',
      description:
        'Medication reminder software for plastic surgery clinics. Every dose becomes a dated ' +
        'reminder sent to the patient by email and push, in Georgian or English.',
      heading: 'Medication reminder software built for post-operative care',
      lead:
        'A post-op medication schedule fails in the gap between the prescription and the dose. ' +
        'Unicorn Care closes it: the clinic records the medicine, its strength and its times of ' +
        'day once, and every dose in the course becomes a reminder the patient actually receives.',
      sections: [
        {
          heading: 'Doses, not documents',
          body:
            'Each medication carries its dosage, route, start and end date and its times of day. ' +
            'The system expands that into one dated reminder per dose across the whole course, so ' +
            'nobody counts days by hand.',
        },
        {
          heading: 'Reminders that arrive early',
          body:
            'Set a lead time per medication and the reminder fires that many minutes before the ' +
            'dose, with the dose time in the message. Time zones and daylight-saving shifts are ' +
            'handled against the clinic’s own zone.',
        },
        {
          heading: 'Adherence back to the clinic',
          body:
            'Patients mark a dose done or skipped from their portal, and the clinic sees the ' +
            'result per plan — so a patient drifting off their schedule is visible before the ' +
            'checkup, not at it.',
        },
      ],
      ctaLabel: 'Set up your clinic',
    },
    ka: {
      title: 'მედიკამენტების შეხსენების პროგრამა კლინიკებისთვის | Unicorn Care',
      description:
        'მედიკამენტების შეხსენების სისტემა პლასტიკური ქირურგიის კლინიკებისთვის. თითოეული დოზა ' +
        'ხდება თარიღიანი შეხსენება, რომელიც პაციენტს ეგზავნება მეილითა და push-ით.',
      heading: 'მედიკამენტების შეხსენება ოპერაციის შემდგომი მოვლისთვის',
      lead:
        'ოპერაციის შემდგომი მედიკამენტების განრიგი ირღვევა დანიშნულებასა და მიღებას შორის ' +
        'დროში. კლინიკა ერთხელ აფიქსირებს მედიკამენტს, დოზასა და მიღების დროს — შემდეგ ' +
        'თითოეული დოზა იქცევა შეხსენებად, რომელსაც პაციენტი მართლა იღებს.',
      sections: [
        {
          heading: 'დოზები, და არა დოკუმენტები',
          body:
            'თითოეულ მედიკამენტს აქვს დოზა, მიღების გზა, დაწყებისა და დასრულების თარიღი და ' +
            'მიღების საათები. სისტემა თავად შლის ამას თარიღიან შეხსენებებად მთელ კურსზე.',
        },
        {
          heading: 'შეხსენება ადრე მოდის',
          body:
            'თითოეულ მედიკამენტს შეუძლია ჰქონდეს საკუთარი წინსწრება: შეხსენება იგზავნება ' +
            'მითითებული წუთებით ადრე, ხოლო თავად მიღების დრო წერია შეტყობინებაში.',
        },
        {
          heading: 'მონაცემები უბრუნდება კლინიკას',
          body:
            'პაციენტი პორტალში აღნიშნავს დოზას შესრულებულად ან გამოტოვებულად, კლინიკა კი ხედავს ' +
            'შედეგს — გეგმიდან გადახვევა ჩანს კონტროლის ვიზიტამდე.',
        },
      ],
      ctaLabel: 'დაარეგისტრირეთ კლინიკა',
    },
  },
};
