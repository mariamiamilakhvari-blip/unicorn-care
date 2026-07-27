import { NextRequest, NextResponse } from 'next/server';

import {
  createProcedureService,
  listByPatientService,
} from '@/features/procedure/service/procedure.service';
import { CreateProcedureSchema } from '@/features/procedure/validations/procedure.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreateProcedureSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createProcedureService(session.clinicId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** `GET /api/procedures?patientId=` (PRD 03 §1). */
export async function GET(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const patientId = req.nextUrl.searchParams.get('patientId');
    if (!patientId) return NextResponse.json({ error: 'PATIENT_ID_REQUIRED' }, { status: 400 });

    const { data, status } = await listByPatientService(session.clinicId, patientId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
