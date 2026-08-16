import { NextResponse } from 'next/server';

import { buildPatientExportService } from '@/features/data-protection/service/patient-export.service';
import { patientGuard } from '@/shared/lib/patient-guard';

/**
 * The data subject access right, answered directly.
 *
 * Under the Law of Georgia on Personal Data Protection a patient is entitled to know what is
 * processed about them and to receive it in a structured, machine-readable form. The platform
 * holds all of it, so there is nothing to route through a clinic queue — turning a right that can
 * be satisfied in one request into a wait for someone to press a button would be the platform
 * adding a delay the statute does not.
 *
 * Served as a download rather than as a JSON body the portal renders. The point of portability is
 * that the file leaves — a patient taking their record to another clinic needs something they can
 * attach to an email, not a screen they can scroll.
 */
export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await buildPatientExportService(session.patientId, session.clinicId);
    if (status !== 200) return NextResponse.json(data, { status });

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="my-health-record.json"',
        /*
          A file of one person's health data must not sit in a shared cache or on disk after the
          session ends. `no-store` is the only directive that binds every hop, including the CDN
          in front of this route.
        */
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
