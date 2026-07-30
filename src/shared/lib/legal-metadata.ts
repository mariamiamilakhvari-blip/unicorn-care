import { getLocale } from 'next-intl/server';

import { LegalSlug, legalDocument } from '@/shared/const/legal.const';
import { localisedUrl, SITE_URL } from '@/shared/const/seo.const';
import { AppLocale } from '@/shared/types/roles';

import type { Metadata } from 'next';

/**
 * Metadata for a legal page.
 *
 * Separate from `buildPageMetadata` because that one draws its title and description from the
 * marketing copy table, which is keyed to the pages that are trying to rank. These are not:
 * they exist so the consent checkboxes point somewhere real. They still carry canonicals and
 * hreflang, because both locales serve the same document at two URLs and Google would otherwise
 * pick one and call the other a duplicate.
 *
 * Indexable on purpose. A privacy policy that search engines cannot see is a privacy policy
 * nobody can check you have.
 */
export async function buildLegalMetadata(slug: LegalSlug, path: string): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const document = legalDocument(slug, locale);

  return {
    title: `${document.title} | Unicorn Care`,
    description: document.intro.slice(0, 155),
    alternates: {
      canonical: localisedUrl(locale, path),
      languages: {
        ka: localisedUrl('ka', path),
        en: localisedUrl('en', path),
        'x-default': localisedUrl('ka', path),
      },
    },
    metadataBase: new URL(SITE_URL),
  };
}
