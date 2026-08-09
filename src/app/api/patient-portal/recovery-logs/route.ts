import { NextRequest, NextResponse } from 'next/server';

import {
  createRecoveryLogService,
  listOwnRecoveryLogsService,
} from '@/features/recovery-log/service/recovery-log.service';
import { CreateRecoveryLogSchema } from '@/features/recovery-log/validations/recovery-log.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listOwnRecoveryLogsService(session.patientId, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreateRecoveryLogSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createRecoveryLogService(
      session.patientId,
      session.clinicId,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
