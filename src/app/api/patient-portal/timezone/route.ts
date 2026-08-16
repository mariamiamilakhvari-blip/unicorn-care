import { NextRequest, NextResponse } from 'next/server';

import { syncPatientTimezoneService } from '@/features/patient/service/patient-timezone.service';
import { PatientTimezoneSchema } from '@/features/patient/validations/patient-timezone.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/**
 * The portal reporting which zone the device is in. Session-scoped like every other portal route:
 * the patient comes from the cookie, never from the body, so this can only ever move the caller's
 * own schedule.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, PatientTimezoneSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await syncPatientTimezoneService(
      session.patientId,
      session.clinicId,
      validated.data.timezone
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
