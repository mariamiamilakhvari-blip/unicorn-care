import { NextResponse, type NextRequest } from 'next/server';

import {
  AUTH_ROUTES,
  DASHBOARD_ROUTE,
  LINK_EXPIRED_ROUTE,
  PATIENT_COOKIE_NAME,
  PATIENT_PORTAL_ROUTE,
  PROTECTED_ROUTES,
  SESSION_COOKIE_NAMES,
  SIGN_IN_ROUTE,
} from '@/shared/const/routes.const';

const matchesRoute = (pathname: string, routes: string[]): boolean =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const isPatientPortalPath = (pathname: string): boolean =>
  matchesRoute(pathname, [PATIENT_PORTAL_ROUTE]);

/** `/p/<token>` — exactly one segment after `/p` — is the public redemption route. */
const isPatientRedemptionPath = (pathname: string): boolean =>
  pathname.split('/').filter(Boolean).length === 2;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const sessionToken = SESSION_COOKIE_NAMES.map((name) => req.cookies.get(name)?.value).find(
    (value) => Boolean(value),
  );

  if (matchesRoute(pathname, AUTH_ROUTES) && sessionToken) {
    return NextResponse.redirect(new URL(DASHBOARD_ROUTE, req.url));
  }

  if (matchesRoute(pathname, PROTECTED_ROUTES) && !sessionToken) {
    const signInUrl = new URL(SIGN_IN_ROUTE, req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isPatientPortalPath(pathname) && !isPatientRedemptionPath(pathname)) {
    const patientToken = req.cookies.get(PATIENT_COOKIE_NAME)?.value;
    if (!patientToken) return NextResponse.redirect(new URL(LINK_EXPIRED_ROUTE, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/p/:path*', '/p', '/sign-in', '/sign-up'],
};
