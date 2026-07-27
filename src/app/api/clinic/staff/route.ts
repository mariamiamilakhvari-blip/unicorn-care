import { NextRequest, NextResponse } from 'next/server';

import { createStaffService } from '@/features/clinic/service/clinic.service';
import { CreateStaffSchema } from '@/features/clinic/validations/clinic.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/**
 * Owner-only. The response carries the generated temporary password exactly once — the product
 * has no email or SMS channel, so the owner hands it over in person.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireOwner();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, CreateStaffSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createStaffService(session.clinicId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
