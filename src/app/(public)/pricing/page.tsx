import { PricingPageView } from '@/features/clinic/components/pricing-page-view';
import { auth } from '@/shared/lib/auth';
import { buildPageMetadata } from '@/shared/lib/page-metadata';

import type { Metadata } from 'next';

type SessionUser = { clinicId?: string | null };

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata('pricing', '/pricing');
}

export default async function PricingPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  return <PricingPageView hasClinic={Boolean(user?.clinicId)} />;
}
