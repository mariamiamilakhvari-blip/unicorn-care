import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { LoginForm } from '@/features/auth/components/login-form';

import type { Metadata } from 'next';

/* A login form has nothing to rank for, and an indexed one only ever shows up on brand queries. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <AuthPageShell>
      <LoginForm />
    </AuthPageShell>
  );
}
