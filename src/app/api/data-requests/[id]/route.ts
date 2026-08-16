import { NextRequest, NextResponse } from 'next/server';

import { resolveDataRequestService } from '@/features/data-protection/service/data-request.service';
import { DataRequestResolveSchema } from '@/features/data-protection/validations/data-protection.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * The clinic answering a data subject request — completing it or refusing it with a reason.
 *
 * Completing an erasure applies it, within the limits statutory retention allows. The staff user
 * is recorded on the resolution: a data subject request is answered by a person, and a record that
 * cannot say who answered is not much of a record.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, DataRequestResolveSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await resolveDataRequestService(
      id,
      session.clinicId,
      session.userId,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
