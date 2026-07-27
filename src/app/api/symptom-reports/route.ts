import { NextRequest, NextResponse } from 'next/server';

import { listSymptomReportsService } from '@/features/recovery-guide/service/symptom-report.service';
import { SYMPTOM_REPORT_STATUSES } from '@/shared/const/recovery.const';
import { clinicGuard } from '@/shared/lib/clinic-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const requested = req.nextUrl.searchParams.get('status');
    const status = SYMPTOM_REPORT_STATUSES.find(candidate => candidate === requested);

    const { data, status: httpStatus } = await listSymptomReportsService(session.clinicId, status);
    return NextResponse.json(data, { status: httpStatus });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
