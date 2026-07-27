import { NextRequest, NextResponse } from 'next/server';

import {
  createCarePlanService,
  getByProcedureService,
} from '@/features/care-plan/service/care-plan.service';
import { CreateCarePlanSchema } from '@/features/care-plan/validations/care-plan.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreateCarePlanSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createCarePlanService(session.clinicId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** `GET /api/care-plans?procedureId=` — one plan per procedure (PRD 01 §6). */
export async function GET(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const procedureId = req.nextUrl.searchParams.get('procedureId');
    if (!procedureId) return NextResponse.json({ error: 'PROCEDURE_ID_REQUIRED' }, { status: 400 });

    const { data, status } = await getByProcedureService(session.clinicId, procedureId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
