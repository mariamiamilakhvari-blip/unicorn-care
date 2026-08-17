import { NextRequest, NextResponse } from 'next/server';

import { resetPasswordService } from '@/features/auth/service/password-reset.service';
import { ResetPasswordSchema } from '@/features/auth/validations/auth.validation';
import { rateLimit } from '@/shared/lib/rate-limit';
import { validateBody } from '@/shared/middleware/validate-body';

const RESET_LIMIT = 10;
const RESET_WINDOW_MS = 15 * 60 * 1000;

/**
 * Redeems a reset link. The token travels in the body, never the query string — a query string
 * reaches access logs and referrer headers, and this one is a live credential until it is spent.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await rateLimit.check(`reset-submit:${ip}`, RESET_LIMIT, RESET_WINDOW_MS);
    if (!allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const validated = await validateBody(req, ResetPasswordSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await resetPasswordService(validated.data);
    if (status === 200) await rateLimit.reset(`reset-submit:${ip}`);

    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
