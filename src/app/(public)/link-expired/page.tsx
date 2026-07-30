import { getTranslations } from 'next-intl/server';

import { LinkExpiredNotice } from '@/features/patient/components/link-expired-notice';

import type { Metadata } from 'next';

/*
  The landing spot for a dead patient magic link. `/p/` is already disallowed in robots.txt; this
  page sits outside that prefix, so without this it is the one portal-adjacent URL a crawler may index.
*/
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LinkExpiredPage() {
  const t = await getTranslations('portal');

  return <LinkExpiredNotice title={t('linkExpired')} help={t('linkExpiredHelp')} />;
}
