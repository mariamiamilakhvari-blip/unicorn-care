import { NextRequest, NextResponse } from 'next/server';

import {
  createClinicForUserService,
  getClinicService,
  updateClinicService,
} from '@/features/clinic/service/clinic.service';
import {
  ClinicProfileSchema,
  UpdateClinicSchema,
} from '@/features/clinic/validations/clinic.validation';
import { auth } from '@/shared/lib/auth';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type SessionUser = { id?: string };

/**
 * Creates a clinic for the signed-in account. Guarded by the plain session rather than
 * `clinicGuard` — by definition the caller has no clinic yet, so the tenancy guard would reject
 * them. The service refuses if the account already belongs to one.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, ClinicProfileSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createClinicForUserService(user.id, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await getClinicService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, UpdateClinicSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await updateClinicService(session.clinicId, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
