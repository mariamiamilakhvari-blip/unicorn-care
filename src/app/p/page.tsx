import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { PortalPlan } from '@/features/care-plan/components/portal-plan';
import { PortalShell } from '@/features/care-plan/components/portal-shell';
import { LINK_EXPIRED_ROUTE } from '@/shared/const/routes.const';
import { patientGuard } from '@/shared/lib/patient-guard';

export default async function PatientPortalPage() {
  const session = await patientGuard.requirePatient();
  if (!session) redirect(LINK_EXPIRED_ROUTE);

  const t = await getTranslations('portal');

  return (
    <PortalShell title={t('yourPlan')} patientName={session.patientName}>
      <PortalPlan />
    </PortalShell>
  );
}
