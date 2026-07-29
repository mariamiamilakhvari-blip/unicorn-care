import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { FeaturePageView } from '@/features/marketing/components/feature-page';
import { APP_NAME } from '@/shared/const/app.const';
import { FEATURE_PAGES, findFeaturePage } from '@/shared/const/feature-page.const';
import { keywordsFor, localisedUrl, SITE_URL } from '@/shared/const/seo.const';
import { AppLocale } from '@/shared/types/roles';

import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

/** Pre-rendered so every cluster page is static HTML a crawler can read without executing JS. */
export function generateStaticParams() {
  return FEATURE_PAGES.map(page => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = findFeaturePage(slug);
  if (!page) return {};

  const locale = (await getLocale()) as AppLocale;
  const copy = page.content[locale];
  const path = `/features/${slug}`;

  return {
    title: copy.title,
    description: copy.description,
    keywords: keywordsFor(locale),
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: localisedUrl(locale, path),
      languages: {
        ka: localisedUrl('ka', path),
        en: localisedUrl('en', path),
        'x-default': localisedUrl('ka', path),
      },
    },
    openGraph: {
      type: 'article',
      siteName: APP_NAME,
      title: copy.title,
      description: copy.description,
      url: localisedUrl(locale, path),
      locale: locale === 'en' ? 'en_US' : 'ka_GE',
    },
  };
}

export default async function FeatureSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = findFeaturePage(slug);
  if (!page) notFound();

  const locale = (await getLocale()) as AppLocale;
  return <FeaturePageView page={page} locale={locale} />;
}
