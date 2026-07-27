'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { isAppLocale, routing, type AppLocale } from '@/i18n/routing';
import { LOCALE_COOKIE_NAME } from '@/shared/const/app.const';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Persists the viewer's language choice. A cookie rather than a URL segment because the patient
 * portal is reached through an opaque magic link — a `/ka/...` prefix would change that URL and
 * break the one address the clinic handed out.
 *
 * Not httpOnly: this is a display preference, not a credential, and nothing is authorised by it.
 */
export async function setLocaleAction(locale: string): Promise<AppLocale> {
  const next: AppLocale = isAppLocale(locale) ? locale : routing.defaultLocale;

  const cookieStore = await cookies();
  cookieStore.set({
    name: LOCALE_COOKIE_NAME,
    value: next,
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });

  // Server Components hold the rendered messages, so the tree has to re-render to pick up the
  // new locale — updating the cookie alone would leave the page in the old language.
  revalidatePath('/', 'layout');

  return next;
}
