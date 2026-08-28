import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/patient-portal/sign-out/route';
import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';

/**
 * Closing a portal session on one device.
 *
 * The cookie is `httpOnly`, so this route is the only thing that can clear it — which is the whole
 * reason it exists rather than a line of client code.
 */
describe('POST /api/patient-portal/sign-out', () => {
  it('clears the portal cookie', async () => {
    const response = await POST();
    const cookie = response.cookies.get(PATIENT_COOKIE_NAME);

    expect(response.status).toBe(200);
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
  });

  /*
    The clear must carry the same attributes the cookie was written with. A mismatched `path` in
    particular does not error — the browser simply keeps the original cookie, and the patient stays
    signed in as somebody else with no sign that anything failed.
  */
  it('matches the attributes the session cookie was set with', async () => {
    const response = await POST();
    const cookie = response.cookies.get(PATIENT_COOKIE_NAME);

    expect(cookie?.path).toBe('/');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
  });

  /*
    Clearing this device is not revoking the credential. Revocation is the clinic's instrument and
    it ends every link the patient holds; this is somebody saying "not my plan" on a shared phone,
    and it must not lock them out of the portal on their own device.
  */
  it('does not need or touch anything but the cookie', async () => {
    const response = await POST();

    await expect(response.json()).resolves.toEqual({ message: 'PORTAL_SESSION_CLEARED' });
  });
});
