import { NextRequest, NextResponse } from 'next/server';

import { registerClinicService } from '@/features/clinic/service/clinic.service';
import { RegisterClinicSchema } from '@/features/clinic/validations/clinic.validation';
import { validateBody } from '@/shared/middleware/validate-body';
import { clientIp } from '@/shared/utils/client-ip';

export async function POST(req: NextRequest) {
  try {
    const validated = await validateBody(req, RegisterClinicSchema);
    if (validated instanceof NextResponse) return validated;

    // Read here, not in the service: the request is the only place the address exists, and a
    // Acceptance of the Data Processing Agreement is recorded with the provenance of the request.
    const { data, status } = await registerClinicService(validated.data, clientIp(req.headers));
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
