import { NextResponse } from 'next/server';

import { listClinicRatingsService } from '@/features/rating/service/rating.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/** A clinic's own standing and the ratings behind it. Read-only — there is no DELETE here. */
export async function GET() {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listClinicRatingsService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
