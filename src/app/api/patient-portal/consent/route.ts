import { NextRequest, NextResponse } from 'next/server';

import {
  changePatientConsentService,
  getConsentSettingsService,
} from '@/features/data-protection/service/consent.service';
import { ConsentChangeSchema } from '@/features/data-protection/validations/data-protection.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';
import { clientIp } from '@/shared/utils/client-ip';

/** The consents currently standing on the caller's own record. */
export async function GET() {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, status } = await getConsentSettingsService(session.patientId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * The patient granting or withdrawing one consent.
 *
 * Session-scoped like every portal route: the patient comes from the cookie and never from the
 * body, so this can only ever change the caller's own record. The address is recorded beside the
 * decision as supporting evidence, which is the one thing about a withdrawal that has to survive
 * being questioned later.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, ConsentChangeSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await changePatientConsentService(
      session.patientId,
      session.clinicId,
      validated.data.type,
      validated.data.granted,
      clientIp(req.headers)
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
