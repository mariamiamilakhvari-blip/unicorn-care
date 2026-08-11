import { getTranslations } from 'next-intl/server';

import { LinkExpiredNotice } from '@/features/patient/components/link-expired-notice';

import type { Metadata } from 'next';

/*
  The landing spot for a dead patient magic link. `/p/` is already disallowed in robots.txt; this
  page sits outside that prefix, so without this it is the one portal-adjacent URL a crawler may index.

  The route and the `linkExpired` message keys are historical names. Patient links no longer
  expire, so a patient reaching this page was revoked, mistyped the URL, or hit the redemption
  rate limit — which is why the copy itself says "invalid or inactive" rather than "expired".
*/
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LinkExpiredPage() {
  const t = await getTranslations('portal');

  return <LinkExpiredNotice title={t('linkExpired')} help={t('linkExpiredHelp')} />;
}
