import { NextRequest, NextResponse } from 'next/server';

import { redeemPortalLinkService } from '@/features/patient/service/portal-link.service';
import { PortalRedeemSchema } from '@/features/patient/validations/portal-link.validation';
import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';
import { rateLimit } from '@/shared/lib/rate-limit';
import { validateBody } from '@/shared/middleware/validate-body';

const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_MS = 10 * 60 * 1000;

/** Matches the staff-link redemption: 400 days is the ceiling Chrome enforces on cookie lifetime. */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Spends an emailed portal link and hands back a session.
 *
 * A POST, and that is the whole point of it. The link used to be redeemed by opening its URL, which
 * is a request any corporate mail filter makes on its own — Outlook Safe Links, Proofpoint and
 * Mimecast all fetch a URL to inspect it before the recipient ever sees the message. Against a
 * single-use link that is fatal: the scanner spends it, receives the cookie, throws both away, and
 * the patient's own tap lands on "invalid or inactive link". Scanners do not POST, so the token is
 * only spent by someone who pressed the button.
 *
 * Unauthenticated, like the request endpoint: the token in the body is the credential.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`portal-login:${ip}`, REDEEM_LIMIT, REDEEM_WINDOW_MS);
    if (!allowed) {
      console.warn('[portal-link] rejected: rate limited', { ip });
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const validated = await validateBody(req, PortalRedeemSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await redeemPortalLinkService(validated.data.token);
    if (status !== 200 || !('accessToken' in data)) {
      return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
    }

    // A valid redemption clears the window so a patient re-opening their portal is never throttled
    // by someone else sharing their egress IP.
    await rateLimit.reset(`portal-login:${ip}`);

    const response = NextResponse.json({ message: 'PORTAL_SESSION_STARTED' }, { status: 200 });
    response.cookies.set({
      name: PATIENT_COOKIE_NAME,
      value: data.accessToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[portal-link] redemption threw', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
