import { NextRequest, NextResponse } from 'next/server';

import { reviseRatingService } from '@/features/rating/service/rating.service';
import { ReviseRatingSchema } from '@/features/rating/validations/rating.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type Params = { params: Promise<{ id: string }> };

/** The 24-hour correction window. Past it the service answers `EDIT_WINDOW_CLOSED`. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, ReviseRatingSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await reviseRatingService(id, session.patientId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
