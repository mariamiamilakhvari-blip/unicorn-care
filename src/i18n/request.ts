import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import en from '@/../messages/en.json';
import ka from '@/../messages/ka.json';

import { isAppLocale, routing, type AppLocale } from '@/i18n/routing';
import { LOCALE_COOKIE_NAME } from '@/shared/const/app.const';

const MESSAGES: Record<AppLocale, typeof ka> = { ka, en };

// TODO(v1.1): move to app/[locale] segment routing
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: AppLocale = isAppLocale(requested) ? requested : routing.defaultLocale;

  return { locale, messages: MESSAGES[locale] };
});
