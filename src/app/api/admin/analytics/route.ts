import { NextRequest, NextResponse } from 'next/server';

import {
  getClinicAnalyticsService,
  listAnalyticsClinicsService,
  quarterRange,
} from '@/features/analytics/service/analytics.service';
import { AnalyticsRangeSchema } from '@/features/analytics/validations/analytics.validation';
import { adminGuard } from '@/shared/lib/admin-guard';

/**
 * Without `clinicId`, the list of clinics the console can report on. With one, that clinic's
 * metrics for the requested window.
 *
 * Two shapes on one route because they are one question asked in two steps — the picker and the
 * thing it picks — and a second endpoint returning six names would be its own file to keep in
 * step with this one.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const clinicId = params.get('clinicId');

    if (!clinicId) {
      const { data, status } = await listAnalyticsClinicsService();
      return NextResponse.json(data, { status });
    }

    const parsed = AnalyticsRangeSchema.safeParse(
      params.get('kind') === 'custom'
        ? { kind: 'custom', from: params.get('from'), to: params.get('to') }
        : { kind: 'quarter', year: params.get('year'), quarter: params.get('quarter') }
    );
    if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });

    const range =
      parsed.data.kind === 'quarter'
        ? quarterRange(parsed.data.year, parsed.data.quarter)
        : {
          from: parsed.data.from.toISOString(),
          to: parsed.data.to.toISOString(),
          label: `${parsed.data.from.toISOString().slice(0, 10)} – ${parsed.data.to.toISOString().slice(0, 10)}`,
        };

    const { data, status } = await getClinicAnalyticsService(clinicId, range);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
