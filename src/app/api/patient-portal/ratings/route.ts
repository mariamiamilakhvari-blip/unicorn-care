import { NextRequest, NextResponse } from 'next/server';

import {
  listRatablePlansService,
  submitRatingService,
} from '@/features/rating/service/rating.service';
import { SubmitRatingSchema } from '@/features/rating/validations/rating.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/** The procedures this patient may rate: finished, and not yet rated. */
export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listRatablePlansService(session.patientId, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, SubmitRatingSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await submitRatingService(
      session.patientId,
      session.clinicId,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
