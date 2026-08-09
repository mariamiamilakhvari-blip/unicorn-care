import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { verifyResetTokenService } from '@/features/auth/service/password-reset.service';

import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

/**
 * The emailed link lands here with the raw token in the query string — the only place it can ride,
 * since a link cannot carry a body. The token is checked on the server before the form is drawn so
 * an expired link is named as one immediately; redeeming it still happens over POST.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token = '' } = await searchParams;
  const { status } = token
    ? await verifyResetTokenService(token)
    : { status: 400 };

  return (
    <AuthPageShell>
      <ResetPasswordForm token={token} isTokenValid={status === 200} />
    </AuthPageShell>
  );
}
