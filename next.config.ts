import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import createNextIntlPlugin from 'next-intl/plugin';

import type { NextConfig } from 'next';

const nextConfigDir = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Built on `default-src 'self'`. Every directive below exists because a bare `default-src 'self'`
 * white-screens the app, so each one is an exception with a reason, not a loosening for comfort:
 *
 * - `script-src 'unsafe-inline'`: Next injects the hydration bootstrap and the RSC flight payload
 *   as inline <script> tags. Without this nothing hydrates. Removing it needs per-request nonces,
 *   which means moving CSP into `src/proxy.ts` — a bigger change than this one.
 * - `'unsafe-eval'` in development only: Turbopack's HMR runtime evals. Never sent in production.
 * - `style-src 'unsafe-inline'`: Next emits inline <style> tags for critical CSS.
 * - `img-src`: Google OAuth avatars (the host already allowlisted in `images.remotePatterns`),
 *   plus `data:` for the inlined SVG icons and `blob:` for next/image.
 * - `connect-src 'self'`: OpenRouter and Dodo are called server-side only, so the browser never
 *   needs an outbound origin. Push subscriptions POST back to our own API.
 * - `frame-ancestors 'none'`: the modern equivalent of X-Frame-Options, which older browsers read.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES.join('; ') },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /*
    Encryption in transit, enforced by the browser rather than hoped for.

    The Law of Georgia on Personal Data Protection requires measures appropriate to the risk of
    processing health data, and TLS at the edge alone leaves one request unprotected: the first
    one, before any redirect. That matters more here than on most products because a portal link
    carries a credential in its path — a single plaintext request would put it in the clear, and
    no amount of correctness afterwards takes it back.

    Two years, subdomains included, and `preload` so a browser that has never seen this host still
    refuses to speak to it in plaintext. `preload` is a commitment: every subdomain must be able to
    serve HTTPS before this ships.
  */
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  // Drops `x-powered-by: Next.js`, which told an attacker which framework to target.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // The patient portal is reached by an opaque magic link. If one ever reaches a crawler,
        // a real patient's care plan would land in a search index.
        source: '/p/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  turbopack: {
    root: nextConfigDir,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
