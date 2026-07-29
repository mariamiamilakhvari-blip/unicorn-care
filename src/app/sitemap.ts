import { FEATURE_PAGES } from '@/shared/const/feature-page.const';
import { INDEXABLE_PATHS, localisedUrl } from '@/shared/const/seo.const';

import type { MetadataRoute } from 'next';

/**
 * Only the marketing pages. The dashboard is behind auth and the patient portal is reached by an
 * opaque magic link — listing either would invite a crawler at a real patient's care plan.
 *
 * Each entry declares both language versions so Google pairs them instead of treating the English
 * page as a duplicate of the Georgian one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const paths = [
    ...INDEXABLE_PATHS,
    ...FEATURE_PAGES.map(page => `/features/${page.slug}`),
  ];

  return paths.map(path => ({
    url: localisedUrl('ka', path),
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
    alternates: {
      languages: {
        ka: localisedUrl('ka', path),
        en: localisedUrl('en', path),
      },
    },
  }));
}
