import { NextRequest, NextResponse } from 'next/server';

import { redeemPortalLinkService } from '@/features/patient/service/portal-link.service';
import {
  LINK_EXPIRED_ROUTE,
  PATIENT_COOKIE_NAME,
  PATIENT_PORTAL_ROUTE,
} from '@/shared/const/routes.const';
import { rateLimit } from '@/shared/lib/rate-limit';

const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_MS = 10 * 60 * 1000;

/** Matches the staff-link redemption: 400 days is the ceiling Chrome enforces on cookie lifetime. */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Redeems the short-lived link a patient asked for by email.
 *
 * The sibling of `/p/[token]`, and separate from it because the two take different credentials:
 * that route takes a durable access token, this one takes a single-use invitation and mints the
 * access token itself. Both end the same way — the raw token in an httpOnly cookie and the token
 * gone from the URL bar in the same hop.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`portal-login:${ip}`, REDEEM_LIMIT, REDEEM_WINDOW_MS);
    if (!allowed) {
      console.warn('[portal-link] rejected: rate limited', { ip });
      return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
    }

    const { token } = await params;
    const { data, status } = await redeemPortalLinkService(token);
    if (status !== 200 || !('accessToken' in data)) {
      return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
    }

    rateLimit.reset(`portal-login:${ip}`);

    const response = NextResponse.redirect(new URL(PATIENT_PORTAL_ROUTE, req.url));
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
    return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
  }
}
