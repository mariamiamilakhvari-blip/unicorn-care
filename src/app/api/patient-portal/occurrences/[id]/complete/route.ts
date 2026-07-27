import { NextRequest, NextResponse } from 'next/server';

import { completeOccurrenceService } from '@/features/care-plan/service/patient-portal.service';
import { patientGuard } from '@/shared/lib/patient-guard';

type RouteContext = { params: Promise<{ id: string }> };

/** Also hit by the service worker's "done" notification action, without opening the app. */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await completeOccurrenceService(session.patientId, id, 'done');
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
