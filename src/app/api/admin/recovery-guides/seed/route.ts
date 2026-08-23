import { NextRequest, NextResponse } from 'next/server';

import { seedDefaultRecoveryGuidesService } from '@/features/recovery-guide/service/recovery-guide-seed.service';
import { adminGuard } from '@/shared/lib/admin-guard';

/**
 * Fills empty platform-default recovery-guide slots with unpublished drafts.
 *
 * Platform-scoped, so it is behind `adminGuard` rather than the tenancy guard — the rows it
 * writes carry `clinicId: null` and belong to no clinic. Safe to call repeatedly: it only ever
 * inserts into slots that are empty, and never touches a clinic's own guide.
 *
 * `?refresh=1` additionally rewrites the text of defaults that already exist, which is how a
 * change to the templates reaches clinics that never wrote their own. It is opt-in in the URL
 * rather than the default so that running the seed out of habit cannot rewrite the platform's
 * clinical reference material. Publication state is never changed either way.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const refresh = req.nextUrl.searchParams.get('refresh') === '1';

    const { data, status } = await seedDefaultRecoveryGuidesService({ refresh });
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
