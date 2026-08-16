import { NextResponse } from 'next/server';

import { listOpenDataRequestsService } from '@/features/data-protection/service/data-request.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/** The clinic's queue of unanswered data subject requests, oldest first. */
export async function GET() {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listOpenDataRequestsService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
