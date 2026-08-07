import { NextRequest, NextResponse } from 'next/server';

import {
  createClinicForUserService,
  getClinicService,
  updateClinicService,
} from '@/features/clinic/service/clinic.service';
import { deleteClinicService } from '@/features/clinic/service/delete-clinic.service';
import {
  CreateClinicForUserSchema,
  DeleteClinicSchema,
  UpdateClinicSchema,
} from '@/features/clinic/validations/clinic.validation';
import { auth } from '@/shared/lib/auth';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';
import { clientIp } from '@/shared/utils/client-ip';

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

    const validated = await validateBody(req, CreateClinicForUserSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await createClinicForUserService(
      user.id,
      validated.data,
      clientIp(req.headers)
    );
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

/**
 * Deletes the clinic account: cancels its subscription, then purges its clinical records and staff
 * logins. Owner-only — a clinic member must not be able to destroy the practice's records — and
 * the body has to repeat the clinic's exact name.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await clinicGuard.requireOwner();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, DeleteClinicSchema);
    if (validated instanceof NextResponse) return validated;

    const result = await deleteClinicService(session.clinicId, validated.data.confirmationName);
    return NextResponse.json(result.data, { status: result.status });
  } catch (caught) {
    console.error('[clinic] delete failed', caught);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
