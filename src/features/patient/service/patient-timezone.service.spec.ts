import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/care-plan/service/care-plan.service', () => ({
  regeneratePlansForTimezoneService: vi.fn(),
}));

import { regeneratePlansForTimezoneService } from '@/features/care-plan/service/care-plan.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { syncPatientTimezoneService } from '@/features/patient/service/patient-timezone.service';

const patients = vi.mocked(patientRepository);
const clinics = vi.mocked(clinicRepository);
const regenerate = vi.mocked(regeneratePlansForTimezoneService);

const PATIENT = '65b0000000000000000000a1';
const CLINIC = '65b0000000000000000000b2';

function patient(timezone: string): PatientDocument {
  return {
    _id: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    timezone,
  } as PatientDocument;
}

beforeEach(() => {
  vi.clearAllMocks();
  patients.findById.mockResolvedValue(patient(''));
  patients.updateById.mockResolvedValue(true);
  clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as never);
  regenerate.mockResolvedValue({ data: { plans: 1, occurrences: 40 }, status: 200 });
});

/**
 * The scenario this exists for: operated on in Tbilisi, recovering at home in Amsterdam. The
 * prescribed 09:30 has to stay 09:30 in both places, and the only thing that can make that true is
 * rebuilding the rows — they hold absolute instants resolved against the zone they were built in.
 */
describe('a patient who has moved', () => {
  it('stores the zone the device reported', async () => {
    await syncPatientTimezoneService(PATIENT, CLINIC, 'Europe/Amsterdam');

    expect(patients.updateById).toHaveBeenCalledWith(
      PATIENT,
      CLINIC,
      expect.objectContaining({ timezone: 'Europe/Amsterdam' })
    );
  });

  it('rebuilds their pending reminders against it', async () => {
    await syncPatientTimezoneService(PATIENT, CLINIC, 'Europe/Amsterdam');

    expect(regenerate).toHaveBeenCalledWith(PATIENT, CLINIC, 'Europe/Amsterdam');
  });

  it('tells the portal the plan it is holding is stale', async () => {
    const result = await syncPatientTimezoneService(PATIENT, CLINIC, 'Europe/Amsterdam');

    expect(result.data).toEqual({ timezone: 'Europe/Amsterdam', changed: true });
  });
});

describe('a patient who has not moved', () => {
  /**
   * The overwhelmingly common call, made on every single portal visit. It must not write and it
   * must not regenerate — a plan rebuilt on every page load would churn every pending row a
   * patient has, daily, for nothing.
   */
  it('does nothing when the device reports the zone already in force', async () => {
    patients.findById.mockResolvedValue(patient('Europe/Amsterdam'));

    const result = await syncPatientTimezoneService(PATIENT, CLINIC, 'Europe/Amsterdam');

    expect(result.data).toEqual({ timezone: 'Europe/Amsterdam', changed: false });
    expect(patients.updateById).not.toHaveBeenCalled();
    expect(regenerate).not.toHaveBeenCalled();
  });

  /**
   * A patient who has never opened the portal has an empty field and a plan built against their
   * clinic. Comparing the report against the empty string rather than against the zone in force
   * would regenerate every plan on first visit, for every patient who never left the city.
   */
  it('treats an empty field as the clinic zone rather than as a change', async () => {
    const result = await syncPatientTimezoneService(PATIENT, CLINIC, 'Asia/Tbilisi');

    expect(result.data).toEqual({ timezone: 'Asia/Tbilisi', changed: false });
    expect(regenerate).not.toHaveBeenCalled();
  });
});

describe('what the endpoint refuses', () => {
  /**
   * The value comes from a patient's browser, and `Intl` throws on a zone it cannot resolve. Storing
   * one would take down the portal read, the generator and every email for that patient at once.
   */
  it('rejects a zone the platform cannot resolve, without writing it', async () => {
    const result = await syncPatientTimezoneService(PATIENT, CLINIC, 'Mars/Olympus_Mons');

    expect(result.status).toBe(422);
    expect(patients.updateById).not.toHaveBeenCalled();
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('404s a patient outside the calling session’s clinic', async () => {
    patients.findById.mockResolvedValue(null);

    const result = await syncPatientTimezoneService(PATIENT, CLINIC, 'Europe/Amsterdam');

    expect(result.status).toBe(404);
    expect(regenerate).not.toHaveBeenCalled();
  });
});
