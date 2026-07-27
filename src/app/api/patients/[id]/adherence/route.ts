import { NextRequest, NextResponse } from 'next/server';

import { getAdherenceService } from '@/features/care-plan/service/care-plan.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await getAdherenceService(session.clinicId, id);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
