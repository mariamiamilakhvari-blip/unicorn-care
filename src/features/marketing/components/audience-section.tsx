import Link from 'next/link';

import { FEATURE_PAGES } from '@/shared/const/feature-page.const';
import { AppLocale } from '@/shared/types/roles';

/**
 * Prose that states, in the words a clinic would search for, what the product is and who it is for.
 *
 * The hero above it is deliberately short and brand-led, which leaves a landing page with almost no
 * indexable body text — a page can rank for nothing it never says. This section carries the
 * vocabulary: post-operative care, rehabilitation programme, patient management, reminders,
 * follow-up. Written as sentences a human would read, not a keyword list, because Google demotes
 * the latter and clinics do not buy from it either.
 */
type SectionCopy = {
  heading: string;
  lead: string;
  blocks: { title: string; body: string }[];
};

const COPY: Record<AppLocale, SectionCopy> = {
  en: {
    heading: 'Plastic surgery patient management software, built around recovery',
    lead:
      'Unicorn Care is plastic surgery clinic software for everything that happens after the ' +
      'operation. One recovery plan per plastic procedure covers the medication schedule, the ' +
      'rehabilitation programme, the checkup dates and the complication guidance — and the patient ' +
      'receives it without the clinic chasing them.',
    blocks: [
      {
        title: 'Post-operative care management',
        body:
          'Record who performed the plastic surgery, what manipulation was carried out and on ' +
          'what date, then build the post-op care plan against it. Surgery recovery management ' +
          'stays in one place instead of spread across notes, messages and phone calls.',
      },
      {
        title: 'Medication reminder software',
        body:
          'Every dose, its strength and its times of day become dated reminders. The patient ' +
          'reminder system sends each one by email and push notification, minutes before it is ' +
          'due, in Georgian or English.',
      },
      {
        title: 'Patient follow-up software',
        body:
          'Checkup dates are reminded ahead of time, and completed doses and tasks come back to ' +
          'the clinic as adherence. Patient follow-up stops depending on whether someone ' +
          'remembered to call.',
      },
      {
        title: 'Patient portal',
        body:
          'Each patient gets a private portal with their own plan, what is normal on which ' +
          'recovery day, and which signs mean they should contact the clinic. No app to install.',
      },
    ],
  },
  ka: {
    heading: 'პლასტიკური ქირურგიის რეაბილიტაციის პროგრამა კლინიკებისთვის',
    lead:
      'Unicorn Care არის პლასტიკური ქირურგიის კლინიკების მართვის სისტემა, რომელიც ფარავს ' +
      'ყველაფერს ოპერაციის შემდეგ. თითოეულ პლასტიკურ პროცედურაზე იქმნება ერთი სარეაბილიტაციო ' +
      'გეგმა: მედიკამენტების განრიგი, პროცედურები, კონტროლის ვიზიტები და გართულებების ინსტრუქცია.',
    blocks: [
      {
        title: 'ოპერაციის შემდგომი მოვლა',
        body:
          'დააფიქსირეთ, ვინ ჩაატარა პლასტიკური ოპერაცია, რა მანიპულაცია შესრულდა და რომელ ' +
          'თარიღში, შემდეგ კი ააგეთ ოპერაციის შემდგომი მართვის გეგმა. ქირურგიული აღდგენა ერთ ' +
          'ადგილას რჩება — არა ჩანაწერებში, მესიჯებსა და ზარებში გაფანტული.',
      },
      {
        title: 'მედიკამენტების შეხსენება',
        body:
          'თითოეული დოზა, მისი რაოდენობა და მიღების დრო იქცევა თარიღიან შეხსენებად. პაციენტს ' +
          'ეგზავნება მეილითა და push შეტყობინებით, მიღებამდე რამდენიმე წუთით ადრე.',
      },
      {
        title: 'პაციენტის მეთვალყურეობა',
        body:
          'კონტროლის ვიზიტზე შეხსენება მოდის წინასწარ, ხოლო შესრულებული დოზები და პროცედურები ' +
          'უბრუნდება კლინიკას. პაციენტების მართვის პროგრამა აჩვენებს, ვინ მისდევს გეგმას.',
      },
      {
        title: 'პაციენტის პორტალი',
        body:
          'თითოეულ პაციენტს აქვს პირადი პორტალი საკუთარი გეგმით: რა არის ნორმა რომელ დღეს და ' +
          'რომელი ნიშნის დროს უნდა დაუკავშირდეს კლინიკას. აპლიკაციის ჩამოტვირთვა საჭირო არ არის.',
      },
    ],
  },
};

export function AudienceSection({ locale }: { locale: AppLocale }) {
  const copy = COPY[locale];
  const prefix = locale === 'en' ? '/en' : '';
  const exploreLabel = locale === 'en' ? 'Explore each part' : 'იხილეთ დეტალურად';

  /*
    The top padding is the break between the benefit cards and the prose. Without it the only gap
    was the cards' own `pb-20`, which read as one continuous block — the cards are a claim, this is
    the argument, and they should not look like the same thought.
  */
  return (
    <section
      aria-labelledby="audience-heading"
      className="mx-auto w-full max-w-5xl px-6 pb-20 pt-24 sm:px-10 sm:pt-32"
    >
      <h2 id="audience-heading" className="font-heading max-w-3xl text-2xl font-semibold sm:text-3xl">
        {copy.heading}
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{copy.lead}</p>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {copy.blocks.map(block => (
          <div key={block.title}>
            <h3 className="text-base font-semibold">{block.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.body}</p>
          </div>
        ))}
      </div>

      {/*
        Internal links to the keyword-cluster pages. A crawler reaches them from here, and the link
        text is the page's own heading rather than "read more", which tells search what is behind it.
      */}
      <nav aria-label={exploreLabel} className="mt-12 border-t border-border pt-8">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {exploreLabel}
        </h3>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FEATURE_PAGES.map(page => (
            <li key={page.slug}>
              <Link
                href={`${prefix}/features/${page.slug}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {page.content[locale].heading}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
