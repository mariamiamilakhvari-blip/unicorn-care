import { NextResponse } from 'next/server';

import { getPublicRatingsService } from '@/features/rating/service/public-rating.service';

export const runtime = 'nodejs';

/**
 * The public rating boards. **Deliberately unauthenticated** — the only route under `/api` that is.
 *
 * That is why it sits under `/api/public/` rather than beside `/api/ratings`: every other route in
 * this tree opens with a `clinicGuard` or a `patientGuard`, and a reader skimming for a missing
 * guard should be able to tell at a glance which routes are meant to have none. The namespace is
 * the signal.
 *
 * What keeps it safe is the service, not a filter here: it returns aggregates plus comments a
 * patient explicitly published, and `PublicRatingsView` has nowhere to put a patient id or a name.
 */
export async function GET() {
  try {
    const { data, status } = await getPublicRatingsService();
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
