import { redirect } from 'next/navigation';

import { AdminPage } from '@/features/admin/components/admin-page';
import { DASHBOARD_ROUTE } from '@/shared/const/routes.const';
import { auth } from '@/shared/lib/auth';
import { UserRole } from '@/shared/types/roles';

type SessionUser = { role?: UserRole };

/**
 * Admin-only. The protected layout admits clinic roles as well as admins, so the narrower check
 * belongs here.
 *
 * This redirect is convenience, not security: it stops a clinic owner landing on a page of
 * controls that would fail, but every route the page calls re-checks the role server-side through
 * `adminGuard`. A page guard alone protects nothing — the API is what holds the line.
 *
 * Sent to the dashboard rather than the sign-in page: the visitor is signed in and simply not an
 * admin, and bouncing an authenticated user to a login form reads as a broken session.
 */
export default async function DashboardAdminPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (user?.role !== 'admin') redirect(DASHBOARD_ROUTE);

  return <AdminPage />;
}
