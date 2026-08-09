import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

import type { Metadata } from 'next';

/* Nothing to rank for, and an indexed reset form is only ever a target. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
