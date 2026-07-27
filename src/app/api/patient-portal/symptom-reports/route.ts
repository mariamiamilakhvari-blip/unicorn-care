import { NextRequest, NextResponse } from 'next/server';

import { createSymptomReportService } from '@/features/recovery-guide/service/symptom-report.service';
import { CreateSymptomReportSchema } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreateSymptomReportSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createSymptomReportService(
      session.patientId,
      session.clinicId,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
