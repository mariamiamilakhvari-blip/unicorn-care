import { NextRequest, NextResponse } from 'next/server';

import { sendQuarterlyReportService } from '@/features/analytics/service/report-dispatch.service';
import { SendReportSchema } from '@/features/analytics/validations/analytics.validation';
import { adminGuard } from '@/shared/lib/admin-guard';
import { validateBody } from '@/shared/middleware/validate-body';

/** Sends one clinic its quarterly summary. Admin-triggered; there is no schedule behind it yet. */
export async function POST(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, SendReportSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await sendQuarterlyReportService(validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
