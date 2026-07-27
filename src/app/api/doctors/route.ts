import { NextResponse } from 'next/server';

import { listDoctorsService } from '@/features/procedure/service/doctor.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/** Derived from procedures — there is no doctor collection to create or delete. */
export async function GET() {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listDoctorsService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
