import { LegalPage } from '@/features/marketing/components/legal-page';
import { buildLegalMetadata } from '@/shared/lib/legal-metadata';

import type { Metadata } from 'next';

export function generateMetadata(): Promise<Metadata> {
  return buildLegalMetadata('privacy', '/privacy');
}

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />;
}
