import { NextRequest, NextResponse } from 'next/server';

import {
  createPatientService,
  listPatientsService,
  PATIENT_PAGE_SIZE,
} from '@/features/patient/service/patient.service';
import { CreatePatientSchema } from '@/features/patient/validations/patient.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';
import { clientIp } from '@/shared/utils/client-ip';

export async function GET(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const page = Number(params.get('page')) || 1;
    const limit = Number(params.get('limit')) || PATIENT_PAGE_SIZE;
    const query = params.get('q') ?? undefined;

    const { data, status } = await listPatientsService(session.clinicId, page, limit, query);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreatePatientSchema);
    if (validated instanceof NextResponse) return validated;

    // Recorded beside the consents this request captures — supporting evidence, never authority.
    const { data, status } = await createPatientService(
      session.clinicId,
      validated.data,
      clientIp(req.headers)
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
