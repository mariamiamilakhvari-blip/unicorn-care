import { NextResponse } from 'next/server';

import { emailEventRepository } from '@/features/notifications/repository/email-event.repository';
import { clearEmailSuppressionService } from '@/features/notifications/service/email-delivery.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/** How many events a clinic needs to see. Older ones say nothing a newer one does not. */
const EVENT_LIMIT = 20;

/**
 * This patient's email standing: whether the address is suppressed, why, and the provider events
 * behind it.
 *
 * Clinic-scoped through `clinicGuard` — the webhook that writes these crosses clinics by
 * necessity, but reading them is ordinary patient data and stays inside the tenancy boundary.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const patient = await patientRepository.findById(id, session.clinicId);
    if (!patient) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const events = await emailEventRepository.findByPatient(id, session.clinicId, EVENT_LIMIT);

    return NextResponse.json(
      {
        email: patient.email ?? '',
        isSuppressed: Boolean(patient.emailSuppressedAt),
        reason: patient.emailSuppressionReason ?? '',
        suppressedAt: patient.emailSuppressedAt?.toISOString() ?? null,
        softBounces: patient.emailSoftBounces ?? 0,
        events: events.map(event => ({
          id: event._id.toString(),
          kind: event.kind,
          bounceType: event.bounceType ?? '',
          message: event.message ?? '',
          email: event.email,
          occurredAt: event.occurredAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * Lifts the suppression.
 *
 * The clinic's call, never the platform's: the fix lives with them — they have corrected the
 * address or spoken to the patient — and a suppression the platform cleared on its own would
 * resume sending to someone who pressed "spam".
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await clinicGuard.requireClinicUser();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await clearEmailSuppressionService(id, session.clinicId);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
