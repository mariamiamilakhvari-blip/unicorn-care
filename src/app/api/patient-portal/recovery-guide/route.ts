import { NextResponse } from 'next/server';

import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { resolveGuideService } from '@/features/recovery-guide/service/recovery-guide.service';
import { patientGuard } from '@/shared/lib/patient-guard';

/**
 * The guide for the patient's most recent procedure, in their own language. `patientId` and
 * `clinicId` come from the magic-link cookie, so a patient can only ever read their own.
 */
export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const procedures = await procedureRepository.findAllByPatient(
      session.patientId,
      session.clinicId
    );
    const latest = procedures[0];
    if (!latest) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, status } = await resolveGuideService(
      session.clinicId,
      latest.manipulationType,
      session.locale
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
