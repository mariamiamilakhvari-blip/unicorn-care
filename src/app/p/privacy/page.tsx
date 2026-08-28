import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PortalShell } from '@/features/care-plan/components/portal-shell';
import { PrivacyPanel } from '@/features/data-protection/components/privacy-panel';
import { LINK_EXPIRED_ROUTE } from '@/shared/const/routes.const';
import { patientGuard } from '@/shared/lib/patient-guard';

import type { Metadata } from 'next';

/*
  Noindex for the same reason the rest of `/p/` is: everything behind this prefix is one patient's
  own data, reached with a credential in the URL.
*/
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where a patient exercises their rights over their own record.
 *
 * Behind the same guard as the plan, which means a patient who has withdrawn portal access cannot
 * reach it — deliberately. Re-granting that one consent is done through the clinic, because
 * someone locked out of the portal cannot toggle a switch that lives inside it.
 */
export default async function PortalPrivacyPage() {
  const session = await patientGuard.requirePatient();
  if (!session) redirect(LINK_EXPIRED_ROUTE);

  const t = await getTranslations('privacy');

  return (
    <PortalShell title={t('title')} patientName={session.patientName}>
      <PrivacyPanel />
    </PortalShell>
  );
}
