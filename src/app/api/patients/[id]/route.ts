import { NextRequest, NextResponse } from 'next/server';

import { deletePatientService } from '@/features/patient/service/delete-patient.service';
import {
  getPatientService,
  updatePatientService,
} from '@/features/patient/service/patient.service';
import {
  DeletePatientSchema,
  UpdatePatientSchema,
} from '@/features/patient/validations/patient.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await getPatientService(session.clinicId, id);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, UpdatePatientSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await updatePatientService(session.clinicId, id, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * A full erasure, not the archive this replaced. Archiving only set `isArchived` and hid the row,
 * which is the right default for tidying a caseload and the wrong one for a patient asking to be
 * erased — a hidden record is still a held record. The service cascades every collection the
 * clinic holds about them.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, DeletePatientSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await deletePatientService(
      session.clinicId,
      id,
      validated.data.confirmationName
    );
    return NextResponse.json(data, { status });
  } catch (caught) {
    /*
      The one route here that logs before it answers. A cascade this wide can fail in a dozen
      places, and a bare `INTERNAL_ERROR` told the clinic nothing and left nothing behind either —
      the deletion simply did not happen, with no trace in the platform logs to say why. Only the
      message: the patient's name and id are the very thing being erased, and neither belongs in a
      log line that outlives the record.
    */
    console.error('[patients] delete failed', caught instanceof Error ? caught.message : caught);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
