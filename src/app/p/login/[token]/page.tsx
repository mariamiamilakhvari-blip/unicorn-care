import { redirect } from 'next/navigation';

import { PortalLoginConfirm } from '@/features/patient/components/portal-login-confirm';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { patientGuard } from '@/shared/lib/patient-guard';

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
  /*
    A device that already holds a session never has to spend a link again.

    This is what stops a clinic edit reading as a lockout. The patient's session is the `uc_patient`
    cookie, which a plan edit does not touch — but the patient does not know that, and the way they
    find out is by tapping the "your plan changed" email. That link is single-use and the one in the
    previous email usually is too, so without this check the most common route back into an updated
    plan lands a signed-in patient on a button that fails, under copy telling them their link is
    dead. They are already through the door: send them in and let the token go unspent.

    Checked before the token is looked at at all, so it holds for a link that is expired, spent, or
    revoked just as well as for a good one.
  */
  const session = await patientGuard.requirePatient();
  if (session) redirect(PATIENT_PORTAL_ROUTE);

  const { token } = await params;

  return <PortalLoginConfirm token={token} />;
}
