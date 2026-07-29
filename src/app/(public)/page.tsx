import { HomePage as MarketingHomePage } from '@/features/marketing/components/home-page';
import { buildPageMetadata } from '@/shared/lib/page-metadata';

import type { Metadata } from 'next';

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata('home', '');
}

export default function HomePage() {
  return <MarketingHomePage />;
}
