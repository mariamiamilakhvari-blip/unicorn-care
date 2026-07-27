import { NextRequest, NextResponse } from 'next/server';

import {
  issueTokenService,
  revokeAccessService,
} from '@/features/patient/service/patient-access.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Issues the patient's magic link. The raw token is in the response body and nowhere else —
 * only its SHA-256 is stored, so this is the single moment the URL can be captured.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await issueTokenService(session.clinicId, id);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** Revokes the link and, with it, the patient's push subscriptions. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await revokeAccessService(session.clinicId, id);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
