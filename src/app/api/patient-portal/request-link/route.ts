import { NextRequest, NextResponse } from 'next/server';

import { requestPortalLinkService } from '@/features/patient/service/portal-link.service';
import { PortalLinkRequestSchema } from '@/features/patient/validations/portal-link.validation';
import { rateLimit } from '@/shared/lib/rate-limit';
import { validateBody } from '@/shared/middleware/validate-body';

const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

/**
 * Unauthenticated on purpose — a patient who cannot open their portal is exactly who this is for,
 * so there is no session to require.
 *
 * Throttled by IP rather than by address, matching the password reset: keying on the submitted
 * email would let anyone spend a known patient's window and lock them out of their own recovery
 * plan, and would not slow a sweep across many addresses, which is the traffic that costs a real
 * outbound email each time.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`portal-link:${ip}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
    if (!allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const validated = await validateBody(req, PortalLinkRequestSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await requestPortalLinkService(validated.data);
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error('[portal-link] request failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
