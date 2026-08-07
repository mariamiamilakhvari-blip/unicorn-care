import { redirect } from 'next/navigation';

import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import { getClinicOverviewService } from '@/features/dashboard/service/dashboard.service';
import { ClinicOverview } from '@/features/dashboard/types/dashboard.types';
import { ADMIN_ROUTE, SIGN_IN_ROUTE } from '@/shared/const/routes.const';
import { auth } from '@/shared/lib/auth';
import { clinicGuard } from '@/shared/lib/clinic-guard';

const EMPTY_OVERVIEW: ClinicOverview = { patientCount: 0, recentPatients: [] };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect(SIGN_IN_ROUTE);

  /*
    An admin has no clinic, so this overview would render zeros for a caseload they are not
    permitted to see anyway. Their landing page is the console — the alternative is an empty
    dashboard that looks like a clinic with no patients rather than an account of a different kind.
  */
  if ((session.user as { role?: string }).role === 'admin') redirect(ADMIN_ROUTE);

  const userName = session.user.name ?? '';

  // A signed-in user without a clinic (the starter's plain `user` role) still gets the page,
  // just with nothing clinical on it.
  const clinicSession = await clinicGuard.requireClinicUser();
  if (!clinicSession) {
    return <DashboardOverview userName={userName} overview={EMPTY_OVERVIEW} />;
  }

  const { data } = await getClinicOverviewService(clinicSession.clinicId);
  const overview = 'error' in data ? EMPTY_OVERVIEW : data;

  return <DashboardOverview userName={userName} overview={overview} />;
}
