import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { SignUpForm } from '@/features/auth/components/signup-form';

import type { Metadata } from 'next';

/*
  Kept out of the index. It is a bare form with no copy worth ranking, and it competes with
  `/clinic-sign-up` — the page that is meant to win the "register your clinic" query.
*/
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUpForm />
    </AuthPageShell>
  );
}
