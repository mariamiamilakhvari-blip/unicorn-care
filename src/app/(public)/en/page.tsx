import { HomePage as MarketingHomePage } from '@/features/marketing/components/home-page';

export { generateMetadata } from '@/app/(public)/page';

/**
 * The English home page. Same component as `/` — the locale is resolved from this URL prefix in
 * `src/i18n/request.ts`, so the page itself needs no locale plumbing.
 */
export default function EnglishHomePage() {
  return <MarketingHomePage />;
}
