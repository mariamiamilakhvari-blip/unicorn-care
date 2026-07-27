import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ka', 'en'],
  defaultLocale: 'ka',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];

export const isAppLocale = (value: string | undefined): value is AppLocale =>
  routing.locales.some((locale) => locale === value);
