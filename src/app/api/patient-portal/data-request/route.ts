import { NextRequest, NextResponse } from 'next/server';

import {
  createDataRequestService,
  listPatientDataRequestsService,
} from '@/features/data-protection/service/data-request.service';
import { DataRequestCreateSchema } from '@/features/data-protection/validations/data-protection.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';
import { clientIp } from '@/shared/utils/client-ip';

/** What this patient has asked for, and what they were told. */
export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listPatientDataRequestsService(session.patientId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** Files a correction or erasure request against the caller's own record. */
export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, DataRequestCreateSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createDataRequestService(
      session.patientId,
      session.clinicId,
      validated.data,
      clientIp(req.headers)
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
