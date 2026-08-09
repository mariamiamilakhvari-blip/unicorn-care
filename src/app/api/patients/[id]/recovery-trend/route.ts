import { NextResponse } from 'next/server';

import { getRecoveryTrendService } from '@/features/recovery-log/service/recovery-log.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type Params = { params: Promise<{ id: string }> };

/** The clinic's chart for one patient. Scoped by the tenancy guard, like every clinical read. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await getRecoveryTrendService(id, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
