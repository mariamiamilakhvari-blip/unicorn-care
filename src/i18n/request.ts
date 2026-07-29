import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import en from '@/../messages/en.json';
import ka from '@/../messages/ka.json';

import { isAppLocale, routing, type AppLocale } from '@/i18n/routing';
import { LOCALE_COOKIE_NAME } from '@/shared/const/app.const';

const MESSAGES: Record<AppLocale, typeof ka> = { ka, en };

/**
 * URL prefix first, cookie second.
 *
 * Georgian is the default locale and stays at `/`; English lives under `/en`. That split is what
 * makes the English pages indexable — a crawler sends no cookie, so a cookie-only strategy served
 * it Georgian at every URL and the English keywords could never rank. Existing Georgian URLs are
 * unchanged, so nothing that is already linked breaks.
 *
 * The cookie still wins on paths with no prefix, which is what the in-app language switcher uses.
 */
export default getRequestConfig(async () => {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '';

  const prefixed = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : undefined;

  const cookieStore = await cookies();
  const requested = prefixed ?? cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: AppLocale = isAppLocale(requested) ? requested : routing.defaultLocale;

  return { locale, messages: MESSAGES[locale] };
});
