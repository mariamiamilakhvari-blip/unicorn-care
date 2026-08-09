import { NextResponse } from 'next/server';

import {
  deletePatientPhotoService,
  PhotoViewer,
  streamPatientPhotoService,
} from '@/features/recovery-log/service/patient-photo.service';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { patientGuard } from '@/shared/lib/patient-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Two kinds of caller reach this route and neither is trusted with an id alone: a clinic user
 * with a dashboard session, and a patient with a magic-link cookie. Clinic first, because a
 * browser could hold both and the clinic session is the narrower claim — it names a user.
 */
async function resolveViewer(): Promise<PhotoViewer | null> {
  const clinic = await clinicGuard.requireClinicUser();
  if (clinic) return { type: 'clinic_user', userId: clinic.userId, clinicId: clinic.clinicId };

  const patient = await patientGuard.requirePatient();
  if (patient) return { type: 'patient', patientId: patient.patientId, clinicId: patient.clinicId };

  return null;
}

/**
 * Serves a private patient photograph through the app rather than from storage.
 *
 * Every byte passes an authorisation check and every read is written to the access log, which a
 * presigned URL handed to the browser could not offer: that is a bearer credential nobody can
 * observe being used, forward, or revoke before it expires.
 *
 * `no-store` is not decoration. A cached post-operative photograph outlives the authorisation
 * that produced it, and a copy on a shared or edge cache is one no revocation reaches.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const result = await streamPatientPhotoService(id, viewer);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Length': String(result.size),
        'Cache-Control': 'no-store, private, max-age=0, must-revalidate',
        // Rendered in place, never run: the browser must not sniff a photograph into something else.
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * Deletes a photograph on request.
 *
 * The consent wording a patient agreed to at upload says they can have it removed, and the BAA
 * repeats the undertaking — so this route is the implementation of a promise already made in
 * production text, not a convenience.
 *
 * Same guard as the read, and the same two callers: the patient whose photograph it is, and their
 * clinic. A clinic deleting on a patient's request is the path the consent wording describes; the
 * patient deleting their own is the same right exercised directly.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const viewer = await resolveViewer();
    if (!viewer) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const result = await deletePatientPhotoService(id, viewer);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
