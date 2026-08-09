import { NextResponse } from 'next/server';

import { getPatientReachabilityService } from '@/features/patient/service/reachability.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type Params = { params: Promise<{ id: string }> };

/** Whether reminders can reach this patient at all. Read-only, tenancy-scoped like every clinical read. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await getPatientReachabilityService(id, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
