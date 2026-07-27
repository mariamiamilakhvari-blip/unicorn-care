import { NextRequest, NextResponse } from 'next/server';

import { askAssistantService } from '@/features/assistant/service/assistant.service';
import { AskAssistantSchema } from '@/features/assistant/validations/assistant.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, AskAssistantSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await askAssistantService(
      session.patientId,
      session.clinicId,
      session.locale,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
