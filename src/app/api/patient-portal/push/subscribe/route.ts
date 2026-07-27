import { NextRequest, NextResponse } from 'next/server';

import {
  subscribeService,
  unsubscribeService,
} from '@/features/notifications/service/push.service';
import {
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from '@/features/notifications/validations/push.validation';
import { patientGuard } from '@/shared/lib/patient-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/** A fresh response per call — a NextResponse body stream can only be consumed once. */
const unauthorized = () => NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

/** Store the browser subscription against the patient behind the portal cookie (PRD 04 §4). */
export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return unauthorized();

    const validated = await validateBody(req, PushSubscribeSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await subscribeService(
      session.patientId,
      session.locale,
      validated.data,
      req.headers.get('user-agent') ?? ''
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/** Deactivate one endpoint. The row survives as the audit trail for why pushes stopped. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return unauthorized();

    const validated = await validateBody(req, PushUnsubscribeSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await unsubscribeService(session.patientId, validated.data.endpoint);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
