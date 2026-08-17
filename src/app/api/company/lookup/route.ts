import { NextRequest, NextResponse } from 'next/server';

import { lookupCompanyService } from '@/features/clinic/service/company-lookup.service';
import { rateLimit } from '@/shared/lib/rate-limit';
import { clientIp } from '@/shared/utils/client-ip';

/**
 * Generous enough to cover a clinic correcting a typo a few times, tight enough that this cannot
 * be used to walk the registry: nine digits is a small enough space that an unthrottled proxy here
 * would be a public bulk-export of Georgian company records, served from our IP.
 */
const LOOKUP_LIMIT = 20;
const LOOKUP_WINDOW_MS = 60 * 1000;

/**
 * `GET /api/company/lookup?taxId=…` — the Georgian Public Registry, proxied.
 *
 * A proxy rather than a direct call from the browser for two reasons: the registry answers with an
 * HTML fragment that the form has no business parsing, and a cross-origin POST from every clinic's
 * browser to a state registry is a different thing to ship than one server-side call.
 *
 * Unauthenticated on purpose — it runs on the sign-up form, before any account exists — so the
 * throttle above is the only thing standing between it and a scraper.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const allowed = await rateLimit.check(`company-lookup:${ip}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS);
    if (!allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const { data, status } = await lookupCompanyService(req.nextUrl.searchParams.get('taxId') ?? '');
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
