import { NextRequest, NextResponse } from 'next/server';

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { resolveGuideService } from '@/features/recovery-guide/service/recovery-guide.service';
import { PatientGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { isAppLocale } from '@/i18n/routing';
import { patientGuard } from '@/shared/lib/patient-guard';

/**
 * The guide for the patient's most recent procedure. `patientId` and `clinicId` come from the
 * magic-link cookie, so a patient can only ever read their own.
 *
 * `?locale=` is the language the patient is *reading the portal in*, which is not necessarily the
 * one on their record: the portal has a language toggle, and before this parameter existed the
 * guide always came back in the clinic's language no matter what the patient chose. The session
 * locale remains the default for a request that does not ask, and anything unrecognised is
 * ignored rather than trusted.
 *
 * The clinic's phone travels with the guide so "contact your clinic" can be a link that dials.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const requested = req.nextUrl.searchParams.get('locale') ?? undefined;
    const locale = isAppLocale(requested) ? requested : session.locale;

    const procedures = await procedureRepository.findAllByPatient(
      session.patientId,
      session.clinicId
    );
    const latest = procedures[0];
    if (!latest) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, status } = await resolveGuideService(
      session.clinicId,
      latest.manipulationType,
      locale
    );
    if (status !== 200 || 'error' in data) return NextResponse.json(data, { status });

    const clinic = await clinicRepository.findById(session.clinicId);
    const body: PatientGuideView = {
      ...data,
      clinic: { name: clinic?.name ?? '', phone: clinic?.phone ?? '' },
    };

    return NextResponse.json(body, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
