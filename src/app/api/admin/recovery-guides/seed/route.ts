import { NextResponse } from 'next/server';

import { seedDefaultRecoveryGuidesService } from '@/features/recovery-guide/service/recovery-guide-seed.service';
import { adminGuard } from '@/shared/lib/admin-guard';

/**
 * Fills empty platform-default recovery-guide slots with unpublished drafts.
 *
 * Platform-scoped, so it is behind `adminGuard` rather than the tenancy guard — the rows it
 * writes carry `clinicId: null` and belong to no clinic. Safe to call repeatedly: it only ever
 * inserts into slots that are empty, and never touches one a clinician has edited or published.
 */
export async function POST() {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await seedDefaultRecoveryGuidesService();
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
