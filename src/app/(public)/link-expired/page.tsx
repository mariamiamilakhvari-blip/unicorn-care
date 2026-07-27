import { getTranslations } from 'next-intl/server';

import { LinkExpiredNotice } from '@/features/patient/components/link-expired-notice';

export default async function LinkExpiredPage() {
  const t = await getTranslations('portal');

  return <LinkExpiredNotice title={t('linkExpired')} help={t('linkExpiredHelp')} />;
}
