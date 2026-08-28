import { NextResponse } from 'next/server';

import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';

/**
 * Closes the portal session on this device, and only on this device.
 *
 * The cookie is `httpOnly`, so nothing in the browser can clear it — which is why this exists as a
 * route rather than a line of client code.
 *
 * It deliberately does **not** revoke the access token behind it. Revocation is the clinic's
 * instrument and it ends every link the patient holds; this is a patient saying "this is not my
 * plan" on a shared phone, and it must not lock them out of the portal on their own. The token
 * stays valid, the tab stops using it, and the next link redeemed on this device wins.
 *
 * Unauthenticated on purpose. Anyone able to send this already holds the cookie it clears, and a
 * guard here would mean a patient whose session had gone strange — a revoked token, a withdrawn
 * consent — could not clear the cookie that was causing it.
 */
export async function POST() {
  const response = NextResponse.json({ message: 'PORTAL_SESSION_CLEARED' }, { status: 200 });

  /*
    Set empty and immediately expired rather than deleted, so a browser holding a stale copy is
    told to overwrite it. `path` must match the one it was written with or the clear silently
    misses and the old cookie survives.
  */
  response.cookies.set({
    name: PATIENT_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
