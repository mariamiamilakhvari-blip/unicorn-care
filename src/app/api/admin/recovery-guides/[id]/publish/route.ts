import { NextRequest, NextResponse } from 'next/server';

import { setDefaultGuidePublishedService } from '@/features/recovery-guide/service/recovery-guide.service';
import { PublishDefaultGuideSchema } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { adminGuard } from '@/shared/lib/admin-guard';
import { validateBody } from '@/shared/middleware/validate-body';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Publishes a platform-default recovery guide, or withdraws one.
 *
 * The seed writes defaults unpublished on purpose and, until this route existed, nothing could
 * raise the flag — so the fallback rung sat in the database unreachable, and every clinic without
 * a guide of its own showed patients the empty state. This is the review step that was missing.
 *
 * Behind `adminGuard`, and reaching platform rows only: a clinic publishes its own clinical text
 * through its own editor, and the id of a clinic's guide answers 404 here rather than being
 * flipped by someone who did not write it.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, PublishDefaultGuideSchema);
    if (validated instanceof NextResponse) return validated;

    const { id } = await params;
    const { data, status } = await setDefaultGuidePublishedService(id, validated.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
