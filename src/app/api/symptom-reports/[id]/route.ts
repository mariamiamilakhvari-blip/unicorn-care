import { NextRequest, NextResponse } from 'next/server';

import { reviewSymptomReportService } from '@/features/recovery-guide/service/symptom-report.service';
import { ReviewSymptomReportSchema } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, ReviewSymptomReportSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await reviewSymptomReportService(
      session.clinicId,
      session.userId,
      id,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
