import { redirect } from 'next/navigation';

import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { ClinicOnboardingForm } from '@/features/clinic/components/clinic-onboarding-form';
import { ClinicSignUpForm } from '@/features/clinic/components/clinic-signup-form';
import { DASHBOARD_ROUTE } from '@/shared/const/routes.const';
import { auth } from '@/shared/lib/auth';
import { buildPageMetadata } from '@/shared/lib/page-metadata';

import type { Metadata } from 'next';

type SessionUser = { id?: string; clinicId?: string | null };

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata('signUp', '/clinic-sign-up');
}

/**
 * One page, two states. A visitor registers an owner and a clinic together; an account that
 * already exists but has no clinic — anyone who came through the plain sign-up form — only needs
 * the clinic half.
 */
export default async function ClinicSignUpPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (user?.clinicId) redirect(DASHBOARD_ROUTE);

  return <AuthPageShell>{user?.id ? <ClinicOnboardingForm /> : <ClinicSignUpForm />}</AuthPageShell>;
}
