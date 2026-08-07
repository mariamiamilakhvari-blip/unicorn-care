import { NextRequest, NextResponse } from 'next/server';

import { listAdminUsersService } from '@/features/admin/service/admin-user.service';
import { AdminListQuerySchema } from '@/features/admin/validations/admin.validation';
import { adminGuard } from '@/shared/lib/admin-guard';

/**
 * The admin console's user list. Platform-scoped: this is the one place that reads across every
 * clinic, which is why it is guarded by `adminGuard` and never by the tenancy guard.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const query = AdminListQuerySchema.safeParse({
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
      search: params.get('search') ?? undefined,
    });
    if (!query.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });

    const { data, status } = await listAdminUsersService(query.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
