import { AppLocale } from '@/shared/types/roles';

/**
 * Search metadata for the public pages.
 *
 * Only `/`, `/pricing` and `/clinic-sign-up` are indexable — the dashboard and the patient portal
 * carry `noindex`, because a magic-link URL in a search index would expose a real patient's care
 * plan. So everything here targets the clinic buying the product, never the patient using it.
 *
 * Keywords live beside the copy they describe rather than in a `<meta keywords>` tag alone: Google
 * has ignored that tag for years, and what actually ranks is the same vocabulary appearing in the
 * title, the headings and the body text.
 */

/**
 * Absolute origin for canonicals, the sitemap and OpenGraph.
 *
 * The `www` host is the canonical one — the apex 308-redirects to it — so every generated URL has
 * to use it. Pointing canonicals at a host that redirects splits ranking signals across two URLs.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.unicorncare.space';

export const KEYWORDS_KA = [
  'პლასტიკური ქირურგიის რეაბილიტაციის პროგრამა',
  'პლასტიკური ოპერაცია',
  'პლასტიკური პროცედურა',
  'პლასტიკური ქირურგიის ოპერაციის შემდგომი მართვის სისტემა',
  'პაციენტების მართვის პროგრამა',
  'ოპერაციის შემდგომი მოვლა',
  'პლასტიკური ქირურგიის პროცედურების რეაბილიტაციის პროგრამა',
  'პლასტიკური ქირურგიის კლინიკების მართვის სისტემა',
  'პაციენტის პორტალი',
  'ესთეტიკური ქირურგია',
  'პოსტოპერაციული რეაბილიტაცია',
  'მედიკამენტების შეხსენება',
  'კონტროლის ვიზიტის შეხსენება',
  'კლინიკის პროგრამა',
  'პაციენტის მეთვალყურეობა',
  'სარეაბილიტაციო გეგმა',
  'ქირურგიული აღდგენა',
  'გართულებების მართვა',
];

export const KEYWORDS_EN = [
  'Plastic Surgery Patient Management Software',
  'Plastic surgery',
  'plastic procedure',
  'Plastic Surgery Clinic Software',
  'Patient Reminder System',
  'Medication Reminder Software',
  'Surgery Recovery Management',
  'Patient Follow-Up Software',
  'post-operative care software',
  'aesthetic clinic software',
  'cosmetic surgery software',
  'patient portal',
  'rehabilitation programme software',
  'checkup reminder software',
  'post-op recovery tracking',
  'surgical aftercare platform',
  'clinic management system',
  'patient adherence tracking',
];

export function keywordsFor(locale: AppLocale): string[] {
  // Both sets ship on both locales: a Georgian clinic often searches the English product term.
  return locale === 'en' ? [...KEYWORDS_EN, ...KEYWORDS_KA] : [...KEYWORDS_KA, ...KEYWORDS_EN];
}

type PageCopy = { title: string; description: string };

/** Titles stay under ~60 characters and descriptions under ~160 so neither is truncated. */
const COPY: Record<AppLocale, Record<'home' | 'pricing' | 'signUp', PageCopy>> = {
  ka: {
    home: {
      title: 'პლასტიკური ქირურგიის რეაბილიტაციის პროგრამა | Unicorn Care',
      description:
        'პლასტიკური ქირურგიის კლინიკების მართვის სისტემა: ოპერაციის შემდგომი მოვლა, ' +
        'მედიკამენტების განრიგი, კონტროლის ვიზიტები და პაციენტის პორტალი ერთ ადგილას.',
    },
    pricing: {
      title: 'ფასები — პაციენტების მართვის პროგრამა | Unicorn Care',
      description:
        'პლასტიკური ქირურგიის ოპერაციის შემდგომი მართვის სისტემის ფასები. 7-დღიანი ' +
        'უფასო საცდელი პერიოდი, საკრედიტო ბარათის გარეშე.',
    },
    signUp: {
      title: 'კლინიკის რეგისტრაცია | Unicorn Care',
      description:
        'დაარეგისტრირეთ თქვენი კლინიკა და დაიწყეთ პაციენტების სარეაბილიტაციო გეგმების მართვა.',
    },
  },
  en: {
    home: {
      title: 'Plastic Surgery Patient Management Software | Unicorn Care',
      description:
        'Plastic surgery clinic software for post-operative care: medication reminders, ' +
        'rehabilitation programmes, checkup follow-up and a patient portal in one system.',
    },
    pricing: {
      title: 'Pricing — Plastic Surgery Clinic Software | Unicorn Care',
      description:
        'Pricing for Unicorn Care, the surgery recovery management and patient follow-up ' +
        'software. 7-day free trial, no credit card required.',
    },
    signUp: {
      title: 'Register your clinic | Unicorn Care',
      description:
        'Create a clinic account and start managing post-operative recovery plans for patients.',
    },
  },
};

export function pageCopy(locale: AppLocale, page: 'home' | 'pricing' | 'signUp'): PageCopy {
  return COPY[locale][page];
}

/** Paths that belong in the sitemap, in both languages. Never the portal or the dashboard. */
export const INDEXABLE_PATHS = ['', '/pricing', '/clinic-sign-up'] as const;

/** Georgian is the default locale and has no prefix, so its URLs are unchanged. */
export function localisedUrl(locale: AppLocale, path: string): string {
  const prefix = locale === 'en' ? '/en' : '';
  return `${SITE_URL}${prefix}${path}`;
}
