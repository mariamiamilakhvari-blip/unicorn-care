import { LegalPage } from '@/features/marketing/components/legal-page';
import { DPA_ROUTE } from '@/shared/const/routes.const';
import { buildLegalMetadata } from '@/shared/lib/legal-metadata';

import type { Metadata } from 'next';

export function generateMetadata(): Promise<Metadata> {
  return buildLegalMetadata('dpa', DPA_ROUTE);
}

export default function DataProcessingAgreementPage() {
  return <LegalPage slug="dpa" />;
}
