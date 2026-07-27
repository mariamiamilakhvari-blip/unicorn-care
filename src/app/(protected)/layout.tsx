import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { DashboardShell } from '@/shared/components/layout/dashboard-shell';
import { Header } from '@/shared/components/layout/header';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { auth } from '@/shared/lib/auth';
import { SessionProvider } from '@/shared/providers/session-provider';
import { StoreProvider } from '@/shared/providers/store-provider';
import { CLINIC_ROLES, type UserRole } from '@/shared/types/roles';

type SessionUser = {
  role?: UserRole;
  clinicId?: string | null;
};

/** Clinic staff and owners are the dashboard's actual users; platform admins keep access too. */
const DASHBOARD_ROLES: UserRole[] = [...CLINIC_ROLES, 'admin'];

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session) redirect('/');

  /*
    A signed-in account with no clinic is sent to onboarding rather than bounced to the home page.
    Silently redirecting to `/` is what made this look like "the dashboard is missing" — the user
    was signed in, saw no dashboard, and had no way to discover why.
  */
  if (!sessionUser?.clinicId && sessionUser?.role !== 'admin') redirect(CLINIC_SIGN_UP_ROUTE);

  if (!sessionUser?.role || !DASHBOARD_ROLES.includes(sessionUser.role)) {
    redirect(CLINIC_SIGN_UP_ROUTE);
  }

  return (
    <SessionProvider>
      <StoreProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <DashboardShell>{children}</DashboardShell>
        </div>
      </StoreProvider>
    </SessionProvider>
  );
}
