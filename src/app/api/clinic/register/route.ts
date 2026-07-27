import { NextRequest, NextResponse } from 'next/server';

import { registerClinicService } from '@/features/clinic/service/clinic.service';
import { RegisterClinicSchema } from '@/features/clinic/validations/clinic.validation';
import { validateBody } from '@/shared/middleware/validate-body';

export async function POST(req: NextRequest) {
  try {
    const validated = await validateBody(req, RegisterClinicSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await registerClinicService(validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
