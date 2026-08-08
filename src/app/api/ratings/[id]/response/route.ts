import { NextRequest, NextResponse } from 'next/server';

import { respondToRatingService } from '@/features/rating/service/rating.service';
import { RespondToRatingSchema } from '@/features/rating/validations/rating.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type Params = { params: Promise<{ id: string }> };

/**
 * The clinic's public reply to a rating.
 *
 * The only write a clinic has against a rating. There is deliberately no route that edits or
 * removes the patient's words: a review a clinic can delete is not a review.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, RespondToRatingSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await respondToRatingService(id, session.clinicId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
