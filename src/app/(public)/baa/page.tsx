import { LegalPage } from '@/features/marketing/components/legal-page';
import { buildLegalMetadata } from '@/shared/lib/legal-metadata';

import type { Metadata } from 'next';

export function generateMetadata(): Promise<Metadata> {
  return buildLegalMetadata('baa', '/baa');
}

export default function BaaPage() {
  return <LegalPage slug="baa" />;
}
