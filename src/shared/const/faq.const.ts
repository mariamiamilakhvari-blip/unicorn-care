import { AppLocale } from '@/shared/types/roles';

/**
 * The landing page FAQ, and the single source for both the visible section and the `FAQPage`
 * JSON-LD.
 *
 * Deliberately one constant rather than two: Google requires structured-data answers to match what
 * a visitor can actually read on the page, and rich results are dropped — sometimes with a manual
 * action — when they drift apart. Sharing the source makes drift impossible.
 *
 * Questions are phrased the way a clinic would type them into a search box, so the answers can
 * match a real query rather than internal product vocabulary.
 */
export type FaqEntry = { question: string; answer: string };

const FAQ: Record<AppLocale, FaqEntry[]> = {
  en: [
    {
      question: 'What is plastic surgery patient management software?',
      answer:
        'It is the system a clinic uses to run post-operative care: medication schedules, ' +
        'rehabilitation tasks, checkup dates and complication guidance, delivered to the patient ' +
        'and tracked back to the clinic.',
    },
    {
      question: 'How does the patient reminder system work?',
      answer:
        'The clinic builds one recovery plan per procedure. Unicorn Care turns it into dated ' +
        'reminders and sends each one to the patient by email and push notification, then reports ' +
        'back which were completed.',
    },
    {
      question: 'Do patients need to install an app?',
      answer:
        'No. Patients open a private portal link in their browser and can add it to their home ' +
        'screen. Reminders also arrive by email.',
    },
    {
      question: 'Can the clinic define what counts as a complication?',
      answer:
        'Yes. Each procedure type has its own guide describing what is normal on which recovery ' +
        'day and which signs mean the patient should call the clinic.',
    },
  ],
  ka: [
    {
      question: 'რა არის პლასტიკური ქირურგიის პაციენტების მართვის პროგრამა?',
      answer:
        'ეს არის სისტემა, რომლითაც კლინიკა მართავს ოპერაციის შემდგომ მოვლას: მედიკამენტების ' +
        'განრიგს, სარეაბილიტაციო პროცედურებს, კონტროლის ვიზიტებს და გართულებების ინსტრუქციას.',
    },
    {
      question: 'როგორ მუშაობს პაციენტის შეხსენების სისტემა?',
      answer:
        'კლინიკა ავსებს სარეაბილიტაციო გეგმას თითოეული პროცედურისთვის. სისტემა გარდაქმნის მას ' +
        'თარიღიან შეხსენებებად და უგზავნის პაციენტს მეილითა და push შეტყობინებით.',
    },
    {
      question: 'სჭირდება თუ არა პაციენტს აპლიკაციის ჩამოტვირთვა?',
      answer:
        'არა. პაციენტი ხსნის პირად ბმულს ბრაუზერში და შეუძლია დაამატოს მთავარ ეკრანზე. ' +
        'შეხსენებები ასევე მოდის მეილზე.',
    },
    {
      question: 'შეუძლია კლინიკას თავად განსაზღვროს, რა ითვლება გართულებად?',
      answer:
        'დიახ. თითოეულ პროცედურის ტიპს აქვს საკუთარი გზამკვლევი: რა არის ნორმა რომელ დღეს და ' +
        'რომელი ნიშნის დროს უნდა დაუკავშირდეს პაციენტი კლინიკას.',
    },
  ],
};

export function faqFor(locale: AppLocale): FaqEntry[] {
  return FAQ[locale];
}
