import { NextRequest, NextResponse } from 'next/server';

import {
  listGuidesService,
  resolveGuideService,
  upsertGuideService,
} from '@/features/recovery-guide/service/recovery-guide.service';
import { UpsertRecoveryGuideSchema } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { clinicGuard } from '@/shared/lib/clinic-guard';
import { validateBody } from '@/shared/middleware/validate-body';
import { AppLocale } from '@/shared/types/roles';

/**
 * With `manipulationType` + `locale`, resolves the single guide the care plan builder edits
 * (falling back to the platform default). Without them, lists everything this clinic has written.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const manipulationType = params.get('manipulationType');
    const requestedLocale = params.get('locale');

    if (manipulationType) {
      const locale: AppLocale = requestedLocale === 'en' ? 'en' : 'ka';
      const resolved = await resolveGuideService(session.clinicId, manipulationType, locale);
      return NextResponse.json(resolved.data, { status: resolved.status });
    }

    const { data, status } = await listGuidesService(session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const validated = await validateBody(req, UpsertRecoveryGuideSchema);
    if (validated instanceof NextResponse) return validated;

    const { data, status } = await upsertGuideService(
      session.clinicId,
      session.userId,
      validated.data
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
