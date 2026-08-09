import { NextRequest, NextResponse } from 'next/server';
import { getLocale } from 'next-intl/server';

import { requestPasswordResetService } from '@/features/auth/service/password-reset.service';
import { ForgotPasswordSchema } from '@/features/auth/validations/auth.validation';
import { isAppLocale } from '@/i18n/routing';
import { rateLimit } from '@/shared/lib/rate-limit';
import { validateBody } from '@/shared/middleware/validate-body';
import { AppLocale } from '@/shared/types/roles';

const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

/**
 * Throttled by IP rather than by address.
 *
 * Keying on the submitted email would let anyone lock a known account out of its own reset by
 * spending the window on it, and would do nothing about a sweep across many addresses — which is
 * the traffic that actually costs anything here, since every accepted request is an outbound email.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`reset-request:${ip}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
    if (!allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const validated = await validateBody(req, ForgotPasswordSchema);
    if (validated instanceof NextResponse) return validated;

    const requested = await getLocale();
    const locale: AppLocale = isAppLocale(requested) ? requested : 'ka';

    const { data, status } = await requestPasswordResetService({ ...validated.data, locale });
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
