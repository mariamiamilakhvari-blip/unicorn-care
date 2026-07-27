import { NextResponse } from 'next/server';

import { getPortalPlanService } from '@/features/care-plan/service/patient-portal.service';
import { patientGuard } from '@/shared/lib/patient-guard';

export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await getPortalPlanService(session.patientId, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
