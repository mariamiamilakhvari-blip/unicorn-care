import { getLocale } from 'next-intl/server';

import { APP_NAME } from '@/shared/const/app.const';
import { keywordsFor, localisedUrl, pageCopy, SITE_URL } from '@/shared/const/seo.const';
import { AppLocale } from '@/shared/types/roles';

import type { Metadata } from 'next';

/**
 * Builds a public page's metadata for whichever locale the URL resolved to.
 *
 * `alternates.languages` is the part that matters most here. Georgian and English are the same
 * page at two URLs, and without hreflang Google treats them as duplicates and picks one — which
 * would waste half the keyword set. `x-default` points at Georgian, the default locale.
 */
export async function buildPageMetadata(
  page: 'home' | 'pricing' | 'signUp',
  path: string
): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const { title, description } = pageCopy(locale, page);
  const canonical = localisedUrl(locale, path);

  return {
    title,
    description,
    keywords: keywordsFor(locale),
    alternates: {
      canonical,
      languages: {
        ka: localisedUrl('ka', path),
        en: localisedUrl('en', path),
        'x-default': localisedUrl('ka', path),
      },
    },
    openGraph: {
      type: 'website',
      siteName: APP_NAME,
      title,
      description,
      url: canonical,
      locale: locale === 'en' ? 'en_US' : 'ka_GE',
      alternateLocale: locale === 'en' ? 'ka_GE' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    metadataBase: new URL(SITE_URL),
  };
}
