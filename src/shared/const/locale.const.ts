import { type AppLocale } from '@/i18n/routing';

export type LocaleOption = {
  value: AppLocale;
  /** Endonym — a language is always listed in its own language, never translated. */
  label: string;
  short: string;
};

export const LOCALE_OPTIONS: LocaleOption[] = [
  { value: 'ka', label: 'ქართული', short: 'ქარ' },
  { value: 'en', label: 'English', short: 'EN' },
];
