import { NextRequest, NextResponse } from 'next/server';

import { redeemTokenService } from '@/features/patient/service/patient-access.service';
import { TOKEN_TTL_DAYS } from '@/features/patient/service/patient-access.service';
import {
  LINK_EXPIRED_ROUTE,
  PATIENT_COOKIE_NAME,
  PATIENT_PORTAL_ROUTE,
} from '@/shared/const/routes.const';
import { rateLimit } from '@/shared/lib/rate-limit';

const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_MS = 10 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = TOKEN_TTL_DAYS * 24 * 60 * 60;

/**
 * Magic-link redemption (PRD 02 §B). A route handler rather than a page so the cookie is set on
 * the redirect response, and so the raw token leaves the URL bar and the browser history in the
 * same hop.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`redeem:${ip}`, REDEEM_LIMIT, REDEEM_WINDOW_MS);
    if (!allowed) {
      return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
    }

    const { token } = await params;
    const { status } = await redeemTokenService(token);
    if (status !== 200) {
      return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
    }

    // A valid redemption clears the window so a patient re-opening their link is never throttled
    // by someone else sharing their egress IP.
    rateLimit.reset(`redeem:${ip}`);

    const response = NextResponse.redirect(new URL(PATIENT_PORTAL_ROUTE, req.url));
    response.cookies.set({
      name: PATIENT_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
  }
}
