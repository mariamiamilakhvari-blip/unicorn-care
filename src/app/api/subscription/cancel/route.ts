import { NextResponse } from 'next/server';

import { cancelSubscriptionService } from '@/features/clinic/service/subscription.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/**
 * Owner-only. Ending the billing relationship is an account decision, not a clinical one, so a
 * doctor with a login cannot switch off the practice's subscription between consultations.
 *
 * No body: there is nothing to choose. The clinic has one subscription and this ends it.
 */
export async function POST() {
  try {
    const session = await clinicGuard.requireOwner();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await cancelSubscriptionService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
