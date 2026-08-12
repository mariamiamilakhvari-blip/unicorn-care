import { NextResponse, type NextRequest } from 'next/server';

import {
  AUTH_ROUTES,
  DASHBOARD_ROUTE,
  LINK_EXPIRED_ROUTE,
  PATIENT_COOKIE_NAME,
  PATIENT_PORTAL_ROUTE,
  PORTAL_LOGIN_ROUTE,
  PROTECTED_ROUTES,
  SESSION_COOKIE_NAMES,
  SIGN_IN_ROUTE,
} from '@/shared/const/routes.const';

const matchesRoute = (pathname: string, routes: string[]): boolean =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const isPatientPortalPath = (pathname: string): boolean =>
  matchesRoute(pathname, [PATIENT_PORTAL_ROUTE]);

/**
 * The two public ways into the portal, both of which carry their credential in the URL and so must
 * reach their route handler without a cookie:
 *
 *   `/p/<token>`        the durable access token from a staff-issued link
 *   `/p/login/<token>`  the single-use link a patient asked for by email
 *
 * Anything else under `/p` is the portal proper and needs the cookie. Getting this wrong is silent
 * in the worst way — the redirect fires before the route runs, so the link looks invalid rather
 * than blocked.
 */
const isPatientRedemptionPath = (pathname: string): boolean => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 2) return true;
  return segments.length === 3 && `/${segments[0]}/${segments[1]}` === PORTAL_LOGIN_ROUTE;
};

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

  /*
    The locale used to come only from a cookie, which meant both languages lived at the same URL.
    A crawler carries no cookie, so it always saw Georgian and the English pages could not be
    indexed at all. `x-pathname` lets the i18n config read the URL prefix instead — see
    `src/i18n/request.ts`. Next.js does not expose the pathname to server components otherwise.
  */
  const headers = new Headers(req.headers);
  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
    Public marketing paths are matched too, so `x-pathname` reaches the i18n config on the pages
    that are actually crawled. Static assets and API routes stay out of it.
  */
  matcher: [
    '/dashboard/:path*',
    '/p/:path*',
    '/p',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
    '/',
    '/en',
    '/en/:path*',
    '/pricing',
    '/clinic-sign-up',
  ],
};
