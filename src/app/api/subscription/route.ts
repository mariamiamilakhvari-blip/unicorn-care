import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getSubscriptionService,
  setPlanService,
} from '@/features/clinic/service/subscription.service';
import { PLAN_KEYS, PlanKey } from '@/shared/const/plan.const';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function GET() {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await getSubscriptionService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

const ChangePlanSchema = z.object({ plan: z.enum(PLAN_KEYS) });

/**
 * Owner-only plan change.
 *
 * No money moves here — no payment provider is wired up (see the billing note in the README).
 * This is the seam a provider's webhook would call after a successful charge, so adding one later
 * changes this handler and nothing downstream.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await clinicGuard.requireOwner();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, ChangePlanSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await setPlanService(
      session.clinicId,
      validated.data.plan as PlanKey
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
