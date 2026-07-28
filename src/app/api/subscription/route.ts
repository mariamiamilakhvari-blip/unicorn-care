import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getSubscriptionService,
  setPlanService,
} from '@/features/clinic/service/subscription.service';
import { PLAN_KEYS, PlanKey } from '@/shared/const/plan.const';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { dodoClient } from '@/shared/lib/dodo-client';
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
 * DEVELOPMENT ONLY. Paid plans are granted exclusively by a verified Dodo webhook; if this
 * endpoint were reachable in live mode any clinic owner could give themselves Premium for free by
 * calling our own API. It is hard-blocked whenever Dodo is in live mode, so the block cannot be
 * lost by forgetting an environment variable.
 */
export async function PATCH(req: NextRequest) {
  try {
    if (dodoClient.isLiveMode()) {
      return NextResponse.json({ error: 'USE_CHECKOUT' }, { status: 403 });
    }

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
