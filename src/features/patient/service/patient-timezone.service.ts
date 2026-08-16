import { regeneratePlansForTimezoneService } from '@/features/care-plan/service/care-plan.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientTimezoneResult } from '@/features/patient/types/patient.types';
import { effectiveTimeZone, isValidTimeZone } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/**
 * Records where a patient is actually recovering, and re-times their plan to match.
 *
 * Called by the portal on every visit with whatever the device reports, so the overwhelmingly
 * common case is "unchanged" and has to be cheap: one read, no write, no regeneration. Only a zone
 * that differs from the one already in force does any work.
 *
 * Deliberately silent to the patient. Someone a week post-operation should not be asked to confirm
 * a timezone dialog they have no way to evaluate — the correct behaviour is that their 09:30 dose
 * says 09:30 wherever they woke up, and nothing else changes.
 *
 * A zone the platform cannot resolve is refused rather than stored. `Intl` throws on an unknown
 * zone, and a bad value here would take out the portal read, the generator and every email at
 * once — with no clinic able to see why, because the value came from a patient's browser.
 */
export async function syncPatientTimezoneService(
  patientId: string,
  clinicId: string,
  reported: string
): Promise<ServiceResult<PatientTimezoneResult>> {
  if (!isValidTimeZone(reported)) {
    console.warn('[patient-timezone] rejected: not a resolvable zone', { patientId });
    return { data: { error: 'INVALID_TIMEZONE' }, status: 422 };
  }

  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  /*
    Compared against the zone currently *in force*, not against the stored field. Those differ for
    every patient who has never opened the portal: the field is empty and the clinic's zone is what
    their plan was built against, so comparing to the empty string would regenerate every plan on
    first visit for patients who never left the city.
  */
  const current = effectiveTimeZone(patient.timezone ?? '', clinic.timezone);
  if (reported === current) {
    return { data: { timezone: current, changed: false }, status: 200 };
  }

  await patientRepository.updateById(patientId, clinicId, {
    timezone: reported,
    timezoneUpdatedAt: clock.now(),
  });

  /*
    Regeneration is the whole point of noticing. The rows already hold absolute instants computed
    from the old zone's wall clock, so without this the patient's schedule stays on the zone they
    left — the field would change and nothing a patient can see would.
  */
  const regenerated = await regeneratePlansForTimezoneService(patientId, clinicId, reported);
  const rebuilt = 'occurrences' in regenerated.data ? regenerated.data.occurrences : 0;

  console.warn('[patient-timezone] moved', { patientId, from: current, to: reported, rebuilt });

  return { data: { timezone: reported, changed: true }, status: 200 };
}
