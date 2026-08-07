import { NextRequest, NextResponse } from 'next/server';

import { updateAdminUserService } from '@/features/admin/service/admin-user.service';
import { UpdateAdminUserSchema } from '@/features/admin/validations/admin.validation';
import { adminGuard } from '@/shared/lib/admin-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/**
 * Changes one user's role or activation.
 *
 * The acting admin's id comes from the session and is passed to the service, which refuses to act
 * on it — an admin cannot demote or deactivate themselves, because the page they would undo it
 * from is the page they just lost access to.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, UpdateAdminUserSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await updateAdminUserService(session.userId, id, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
