import { NextRequest, NextResponse } from 'next/server';

import { uploadPatientPhotoService } from '@/features/recovery-log/service/photo-upload.service';
import { patientGuard } from '@/shared/lib/patient-guard';

export const runtime = 'nodejs';

/**
 * Photograph upload. Multipart, so `validateBody` does not apply — the checking that matters here
 * is size and type, neither of which is expressible as a Zod body schema.
 *
 * Consent is read off the form and must be the literal string `true`. It is refused before the
 * bytes are touched: an upload that stored the photograph and then failed the consent check would
 * have already done the thing consent was meant to authorise.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await patientGuard.requirePatient();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const form = await req.formData();

    if (form.get('consentGranted') !== 'true') {
      return NextResponse.json({ error: 'CONSENT_REQUIRED' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });

    const { data, status } = await uploadPatientPhotoService(
      session.patientId,
      session.clinicId,
      file
    );
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
