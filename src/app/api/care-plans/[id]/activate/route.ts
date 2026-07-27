import { NextRequest, NextResponse } from 'next/server';

import { activateCarePlanService } from '@/features/care-plan/service/care-plan.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type RouteContext = { params: Promise<{ id: string }> };

/** No body: the plan already holds everything activation validates (PRD 03 §Activation). */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await activateCarePlanService(session.clinicId, id);
    return NextResponse.json(data, { status });
  } catch (error) {
    // Activation runs the occurrence generator over clinic-entered data, so a bad plan surfaces
    // here as a throw. Swallowing it left "INTERNAL_ERROR" on screen and nothing in the log.
    console.error('[care-plan:activate] failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
