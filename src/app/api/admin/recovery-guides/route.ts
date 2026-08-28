import { NextResponse } from 'next/server';

import { listDefaultGuidesService } from '@/features/recovery-guide/service/recovery-guide.service';
import { adminGuard } from '@/shared/lib/admin-guard';

/**
 * The platform defaults, for the admin review queue.
 *
 * Platform-scoped, so it is behind `adminGuard` rather than the tenancy guard — these rows carry
 * `clinicId: null` and belong to no clinic. It is deliberately the only listing that reads them:
 * a clinic's own guides come back from `/api/recovery-guides` under its tenancy, and nothing here
 * can reach across into them.
 */
export async function GET() {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await listDefaultGuidesService();
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
