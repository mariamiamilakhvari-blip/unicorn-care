import { PortalLoginConfirm } from '@/features/patient/components/portal-login-confirm';

import type { Metadata } from 'next';

/*
  Where every emailed portal link lands. A page rather than the route handler it replaced, because
  redemption is now a POST the patient makes from here: a link that spent itself on GET was being
  consumed by the mail scanners that fetch URLs before delivery, and the patient's own tap then
  found it used.

  Noindex for the same reason `/link-expired` is: the URL carries a credential, and `/p/` is the
  only portal prefix robots.txt disallows.
*/
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PortalLoginConfirm token={token} />;
}
