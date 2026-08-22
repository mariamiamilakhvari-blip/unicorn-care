import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/service/care-plan.service', () => ({
  regeneratePlansForTimezoneService: vi.fn(),
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

import { regeneratePlansForTimezoneService } from '@/features/care-plan/service/care-plan.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { updatePatientService } from '@/features/patient/service/patient.service';

const patients = vi.mocked(patientRepository);
const clinics = vi.mocked(clinicRepository);
const regenerate = vi.mocked(regeneratePlansForTimezoneService);

const CLINIC = '507f1f77bcf86cd799439011';
const PATIENT = '507f1f77bcf86cd799439022';

const patient = (timezone: string): PatientDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    firstName: 'Nino',
    lastName: 'Beridze',
    locale: 'ka',
    sex: 'female',
    timezone,
  }) as PatientDocument;

beforeEach(() => {
  vi.resetAllMocks();
  clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
  patients.updateById.mockResolvedValue(patient('') as never);
  regenerate.mockResolvedValue({ data: { plans: 1, occurrences: 42 }, status: 200 });
});

/**
 * A patient's zone is the one field on the record that re-times a schedule. The occurrence rows
 * hold absolute instants resolved from the prescribed wall clock, so saving the field and stopping
 * there leaves the reminders on the clock of the country the patient has left.
 */
describe('updatePatientService — moving a patient between zones', () => {
  it('re-times the plan when the zone actually changes', async () => {
    patients.findById.mockResolvedValueOnce(patient('')).mockResolvedValueOnce(
      patient('Europe/Amsterdam')
    );

    await updatePatientService(CLINIC, PATIENT, { timezone: 'Europe/Amsterdam' });

    expect(regenerate).toHaveBeenCalledWith(PATIENT, CLINIC, 'Europe/Amsterdam');
  });

  /**
   * Compared as *effective* zones. A clinic typing the zone its patient was already inheriting has
   * moved nobody, and rebuilding there would drop and re-insert every pending row for nothing.
   */
  it('does not re-time when the clinic names the zone already in force', async () => {
    patients.findById.mockResolvedValue(patient(''));

    await updatePatientService(CLINIC, PATIENT, { timezone: 'Asia/Tbilisi' });

    expect(regenerate).not.toHaveBeenCalled();
  });

  /** Clearing the field is a real move: the patient goes back to following the clinic. */
  it('re-times when a patient is put back on the clinic’s zone', async () => {
    patients.findById.mockResolvedValue(patient('Europe/Amsterdam'));

    await updatePatientService(CLINIC, PATIENT, { timezone: '' });

    expect(regenerate).toHaveBeenCalledWith(PATIENT, CLINIC, 'Asia/Tbilisi');
  });

  /** Every other field leaves the schedule alone — this must not fire on a phone number. */
  it('leaves the schedule alone when the edit carries no timezone', async () => {
    patients.findById.mockResolvedValue(patient('Europe/Amsterdam'));

    await updatePatientService(CLINIC, PATIENT, { phone: '+995 555 00 00 00' });

    expect(regenerate).not.toHaveBeenCalled();
  });

  /**
   * The record has already been corrected by the time regeneration runs. Surfacing a failure here
   * would tell the clinic nothing was saved, when in fact the edit landed — and the next portal
   * visit rebuilds the rows anyway.
   */
  it('keeps the edit when re-timing throws', async () => {
    patients.findById.mockResolvedValue(patient('Europe/Amsterdam'));
    regenerate.mockRejectedValue(new Error('mongo is down'));

    const { status } = await updatePatientService(CLINIC, PATIENT, { timezone: 'Europe/Paris' });

    expect(status).toBe(200);
  });
});
