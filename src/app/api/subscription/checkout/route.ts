import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { startCheckoutService } from '@/features/clinic/service/billing.service';
import { BILLING_PERIODS } from '@/shared/const/billing.const';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

const StartCheckoutSchema = z.object({
  plan: z.enum(['standard', 'premium']),
  period: z.enum(BILLING_PERIODS),
});

/**
 * Owner-only. Returns a hosted checkout URL for the browser to redirect to.
 *
 * Creating a session grants nothing — the plan only changes when the signed webhook arrives.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireOwner();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, StartCheckoutSchema);
    if (validated instanceof NextResponse) return validated;

    const appUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

    const { data, status } = await startCheckoutService(
      session.clinicId,
      session.userId,
      validated.data.plan,
      validated.data.period,
      appUrl
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
