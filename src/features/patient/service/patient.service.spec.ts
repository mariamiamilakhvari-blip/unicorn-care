import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/service/care-plan.service', () => ({
  regeneratePlansForTimezoneService: vi.fn(),
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/clinic/service/subscription.service', () => ({
  checkPatientSeat: vi.fn(),
}));

vi.mock('@/features/data-protection/service/consent.service', () => ({
  recordIntakeConsentsService: vi.fn(),
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { create: vi.fn(), findById: vi.fn(), updateById: vi.fn() },
}));

import { regeneratePlansForTimezoneService } from '@/features/care-plan/service/care-plan.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { checkPatientSeat } from '@/features/clinic/service/subscription.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import {
  createPatientService,
  updatePatientService,
} from '@/features/patient/service/patient.service';
import { CreatePatientType } from '@/features/patient/validations/patient.validation';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';

const patients = vi.mocked(patientRepository);
const clinics = vi.mocked(clinicRepository);
const seat = vi.mocked(checkPatientSeat);
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

const intake = (): CreatePatientType =>
  ({
    firstName: 'Nino',
    lastName: 'Beridze',
    phone: '',
    email: '',
    dateOfBirth: null,
    sex: 'female',
    locale: 'ka',
    allergies: [],
    notes: '',
    consents: {
      personalData: true,
      healthData: true,
      reminders: true,
      portalAccess: true,
      informed: true,
      accurate: true,
      corrections: true,
    },
  }) as CreatePatientType;

const written = () => patients.create.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.resetAllMocks();
  clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
  seat.mockResolvedValue({ ok: true } as never);
  patients.create.mockResolvedValue(PATIENT);
  patients.findById.mockResolvedValue(patient('Asia/Tbilisi'));
  patients.updateById.mockResolvedValue(true as never);
  regenerate.mockResolvedValue({ data: { plans: 1, occurrences: 42 }, status: 200 });
});

/**
 * The zone is written at intake and never asked for. Recovery starts where the operation happened,
 * so the clinic's own zone is the right answer for every new patient — and it is one nobody has to
 * be right about, which the picker that stood here was not.
 */
describe('createPatientService — where a new patient starts', () => {
  it("stores the clinic's own zone", async () => {
    const { status } = await createPatientService(CLINIC, intake());

    expect(status).toBe(201);
    expect(written()).toMatchObject({ timezone: 'Asia/Tbilisi' });
  });

  /* Written out rather than left blank: readers should not have to know that empty means inherit. */
  it('never writes a blank zone', async () => {
    await createPatientService(CLINIC, intake());

    expect(written()?.timezone).toBeTruthy();
  });

  it('takes whatever zone the clinic is in, not a hardcoded one', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Amsterdam' } as ClinicDocument);

    await createPatientService(CLINIC, intake());

    expect(written()).toMatchObject({ timezone: 'Europe/Amsterdam' });
  });

  /* A plan cannot be built against nothing, so an unusable clinic zone falls back rather than sticks. */
  it.each([
    ['an unresolvable clinic zone', { timezone: 'Mars/Olympus' } as ClinicDocument],
    ['a clinic with no zone at all', { timezone: '' } as ClinicDocument],
    ['no clinic row', null],
  ])('falls back to the platform default on %s', async (_label, clinic) => {
    clinics.findById.mockResolvedValue(clinic as never);

    await createPatientService(CLINIC, intake());

    expect(written()).toMatchObject({ timezone: DEFAULT_TIMEZONE });
  });
});

/**
 * The clinic-side zone edit went with the picker that set it. A zone the clinic types is a guess in
 * front of a measurement: the patient's own device reports where they actually are, and
 * `syncPatientTimezoneService` owns the regeneration a real move requires.
 */
describe('updatePatientService — no longer a way to move a patient', () => {
  it('never re-times a plan, whatever the edit carries', async () => {
    await updatePatientService(CLINIC, PATIENT, { phone: '+995 555 00 00 00' });

    expect(regenerate).not.toHaveBeenCalled();
  });

  /* The schema drops it before the service is reached; this pins that nothing downstream acts on it. */
  it('does not write a timezone even if one reaches it', async () => {
    await updatePatientService(CLINIC, PATIENT, { phone: '+995 555 00 00 00' });

    expect(patients.updateById).toHaveBeenCalledWith(PATIENT, CLINIC, {
      phone: '+995 555 00 00 00',
    });
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('404s on a patient outside the clinic', async () => {
    patients.findById.mockResolvedValue(null);

    const { status } = await updatePatientService(CLINIC, PATIENT, { phone: '+995 1' });

    expect(status).toBe(404);
  });
});
