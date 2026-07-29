import { SITE_URL } from '@/shared/const/seo.const';

import type { MetadataRoute } from 'next';

/**
 * Replaces the static `public/robots.txt` so the sitemap URL follows `SITE_URL` instead of being
 * hard-coded — a stale absolute URL here silently stops a site being crawled after a domain change.
 *
 * `/p/` stays disallowed. That is the patient portal, and a magic link reaching a crawler would put
 * someone's medical plan in a public index. `X-Robots-Tag: noindex` in `next.config.ts` is the
 * belt to this braces: `Disallow` stops crawling, only the header stops indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/p/', '/dashboard/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
