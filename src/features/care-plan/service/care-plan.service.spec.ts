import { Types } from 'mongoose';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByProcedureId: vi.fn(),
    findActiveByPatient: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    insertMany: vi.fn(),
    deletePendingByCarePlan: vi.fn(),
    findByPatientAndRange: vi.fn(),
    findByCarePlan: vi.fn(),
    countByStatusForPlan: vi.fn(),
    countUndeliveredForPlan: vi.fn(),
  },
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

vi.mock('@/features/recovery-guide/service/resolve-guide.service', () => ({
  resolveGuideForProcedure: vi.fn(),
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { CreateCarePlanType } from '@/features/care-plan/validations/care-plan.validation';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { resolveGuideForProcedure } from '@/features/recovery-guide/service/resolve-guide.service';

import {
  activateCarePlanService,
  createCarePlanService,
  getAdherenceService,
  getByProcedureService,
  getCarePlanService,
  listOccurrencesService,
  updateCarePlanService,
} from './care-plan.service';

const plans = vi.mocked(carePlanRepository);
const occurrences = vi.mocked(reminderOccurrenceRepository);
const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);
const resolveGuide = vi.mocked(resolveGuideForProcedure);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439022';
const PROCEDURE_ID = '507f1f77bcf86cd799439033';
const PLAN_ID = '507f1f77bcf86cd799439044';

const STARTS_AT = new Date('2025-06-01T00:00:00.000Z');
const REHAB_ENDS_AT = new Date('2025-09-01T00:00:00.000Z');

function createInput(): CreateCarePlanType {
  return {
    procedureId: PROCEDURE_ID,
    patientId: PATIENT_ID,
    startsAt: STARTS_AT,
    recoveryLogEnabled: false,
    rehabEndsAt: REHAB_ENDS_AT,
    medications: [
      {
        name: 'Amoxicillin',
        dosage: '500 mg',
        route: 'oral',
        timesOfDay: ['08:00'],
        startsOn: new Date('2025-06-02T00:00:00.000Z'),
        endsOn: new Date('2025-06-05T00:00:00.000Z'),
        withFood: true,
        instructions: '',
        remindMinutesBefore: 0,
      },
    ],
    rehabTasks: [],
    checkups: [],
  };
}

function planDoc(overrides: Partial<CarePlanDocument> = {}): CarePlanDocument {
  const doc = {
    _id: new Types.ObjectId(PLAN_ID),
    procedureId: new Types.ObjectId(PROCEDURE_ID),
    patientId: new Types.ObjectId(PATIENT_ID),
    clinicId: new Types.ObjectId(CLINIC_ID),
    startsAt: STARTS_AT,
    rehabEndsAt: REHAB_ENDS_AT,
    status: 'draft',
    medications: [{ _id: new Types.ObjectId(), ...createInput().medications[0] }],
    rehabTasks: [],
    checkups: [],
    ...overrides,
  };
  return doc as CarePlanDocument;
}

beforeEach(() => {
  vi.clearAllMocks();
  clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'en' } as never);
  resolveGuide.mockResolvedValue(null);
  plans.create.mockResolvedValue(PLAN_ID);
  plans.updateById.mockResolvedValue(true);
  occurrences.deletePendingByCarePlan.mockResolvedValue(0);
  occurrences.insertMany.mockResolvedValue(0);
});

describe('createCarePlanService', () => {
  it('persists a draft with the session clinic, never a body clinicId', async () => {
    plans.findById.mockResolvedValue(planDoc());

    const result = await createCarePlanService(CLINIC_ID, createInput());

    expect(result.status).toBe(201);
    const payload = plans.create.mock.calls[0][0];
    expect(payload.status).toBe('draft');
    expect(payload.clinicId.toString()).toBe(CLINIC_ID);
    expect(payload.procedureId.toString()).toBe(PROCEDURE_ID);
    expect(occurrences.insertMany).not.toHaveBeenCalled();
  });

  it('404s when the freshly created plan is not readable by this clinic', async () => {
    plans.findById.mockResolvedValue(null);

    expect(await createCarePlanService(CLINIC_ID, createInput())).toEqual({
      data: { error: 'NOT_FOUND' },
      status: 404,
    });
  });
});

describe('reads', () => {
  it('getCarePlanService 404s for another clinic id', async () => {
    plans.findById.mockResolvedValue(null);

    const result = await getCarePlanService(CLINIC_ID, PLAN_ID);

    expect(result.status).toBe(404);
    expect(plans.findById).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
  });

  it('getByProcedureService returns the one plan a procedure owns', async () => {
    plans.findByProcedureId.mockResolvedValue(planDoc());

    const result = await getByProcedureService(CLINIC_ID, PROCEDURE_ID);

    expect(result.status).toBe(200);
    expect(plans.findByProcedureId).toHaveBeenCalledWith(PROCEDURE_ID, CLINIC_ID);
  });

  /**
   * Scoped by plan, not by date. The previous range query was bounded by `rehabEndsAt`, which
   * silently hid checkup reminders scheduled after rehabilitation ends — the row existed in the
   * database but never reached the clinic.
   */
  it('listOccurrencesService queries by plan so late checkups are not hidden', async () => {
    plans.findById.mockResolvedValue(planDoc());
    const afterRehabEnds = new Date(STARTS_AT.getTime() + 90 * 24 * 60 * 60 * 1000);
    occurrences.findByCarePlan.mockResolvedValue([
      { carePlanId: new Types.ObjectId(PLAN_ID), dueAt: STARTS_AT, kind: 'medication' },
      { carePlanId: new Types.ObjectId(PLAN_ID), dueAt: afterRehabEnds, kind: 'checkup' },
    ] as never);

    const result = await listOccurrencesService(CLINIC_ID, PLAN_ID);

    expect(occurrences.findByCarePlan).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ total: 2 });
  });
});

describe('activateCarePlanService', () => {
  it('refuses a plan with nothing to remind about and writes nothing', async () => {
    plans.findById.mockResolvedValue(planDoc({ medications: [], rehabTasks: [], checkups: [] }));

    const result = await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(result).toEqual({ data: { error: 'INCOMPLETE_PLAN' }, status: 422 });
    expect(occurrences.deletePendingByCarePlan).not.toHaveBeenCalled();
    expect(occurrences.insertMany).not.toHaveBeenCalled();
    expect(plans.updateById).not.toHaveBeenCalled();
  });

  it('drops only pending rows, inserts fresh ones, then flips the status', async () => {
    plans.findById.mockResolvedValue(planDoc());

    const result = await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(result.status).toBe(200);
    expect(occurrences.deletePendingByCarePlan).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
    // 4 days × 1 time of day.
    expect(occurrences.insertMany.mock.calls[0][0]).toHaveLength(4);
    expect(plans.updateById).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID, { status: 'active' });

    const [deleteOrder] = occurrences.deletePendingByCarePlan.mock.invocationCallOrder;
    const [insertOrder] = occurrences.insertMany.mock.invocationCallOrder;
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it('404s without touching occurrences when the plan is not this clinic\'s', async () => {
    plans.findById.mockResolvedValue(null);

    expect(await activateCarePlanService(CLINIC_ID, PLAN_ID)).toEqual({
      data: { error: 'NOT_FOUND' },
      status: 404,
    });
    expect(occurrences.deletePendingByCarePlan).not.toHaveBeenCalled();
  });

  it('needs the clinic to resolve the timezone before generating', async () => {
    plans.findById.mockResolvedValue(planDoc());
    clinics.findById.mockResolvedValue(null);

    expect(await activateCarePlanService(CLINIC_ID, PLAN_ID)).toEqual({
      data: { error: 'CLINIC_NOT_FOUND' },
      status: 404,
    });
    expect(occurrences.insertMany).not.toHaveBeenCalled();
  });
});

describe('updateCarePlanService', () => {
  it('leaves a draft unmaterialised', async () => {
    plans.findById.mockResolvedValue(planDoc());

    const result = await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    expect(result.status).toBe(200);
    expect(plans.updateById).toHaveBeenCalledTimes(1);
    expect(occurrences.insertMany).not.toHaveBeenCalled();
  });

  it('re-runs activation when the plan is already active', async () => {
    plans.findById.mockResolvedValue(planDoc({ status: 'active' }));

    const result = await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    expect(result.status).toBe(200);
    expect(occurrences.deletePendingByCarePlan).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
    expect(occurrences.insertMany).toHaveBeenCalled();
  });

  it('404s when nothing matched the clinic-scoped filter', async () => {
    plans.updateById.mockResolvedValue(false);

    expect(await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput())).toEqual({
      data: { error: 'NOT_FOUND' },
      status: 404,
    });
  });
});

describe('getAdherenceService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-10T09:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('404s for a patient outside the clinic', async () => {
    patients.findById.mockResolvedValue(null);

    expect(await getAdherenceService(CLINIC_ID, PATIENT_ID)).toEqual({
      data: { error: 'NOT_FOUND' },
      status: 404,
    });
  });

  it('counts a row a dispatch run is holding as pending, not as its own bucket', async () => {
    patients.findById.mockResolvedValue({ _id: new Types.ObjectId(PATIENT_ID) } as never);
    plans.findActiveByPatient.mockResolvedValue([planDoc()]);
    occurrences.countByStatusForPlan.mockResolvedValue([
      { _id: 'sending', count: 2 },
      { _id: 'pending', count: 1 },
    ]);
    occurrences.findByPatientAndRange.mockResolvedValue([
      { status: 'sending', dueAt: new Date('2025-06-10T06:00:00.000Z') },
    ] as never);

    const result = await getAdherenceService(CLINIC_ID, PATIENT_ID);
    const summary = result.data;
    if ('error' in summary) throw new Error('expected an adherence summary');

    // `sending` is an internal claim state; the clinic sees the reminder as still pending.
    expect(summary.totals).toEqual({ pending: 3, sent: 0, done: 0, skipped: 0, missed: 0 });
    expect(summary.totals).not.toHaveProperty('sending');
    expect(summary.lastSevenDays[6].pending).toBe(1);
    expect(summary.lastSevenDays[6].total).toBe(1);
  });

  it('sums status counts across the active plans and buckets the trailing week', async () => {
    patients.findById.mockResolvedValue({ _id: new Types.ObjectId(PATIENT_ID) } as never);
    plans.findActiveByPatient.mockResolvedValue([planDoc(), planDoc()]);
    occurrences.countByStatusForPlan.mockResolvedValue([
      { _id: 'done', count: 3 },
      { _id: 'missed', count: 1 },
    ]);
    occurrences.findByPatientAndRange.mockResolvedValue([
      { status: 'done', dueAt: new Date('2025-06-10T06:00:00.000Z') },
      { status: 'skipped', dueAt: new Date('2025-06-09T06:00:00.000Z') },
    ] as never);

    const result = await getAdherenceService(CLINIC_ID, PATIENT_ID);
    const summary = result.data;

    expect(result.status).toBe(200);
    if ('error' in summary) throw new Error('expected an adherence summary');

    expect(summary.totals).toEqual({ pending: 0, sent: 0, done: 6, skipped: 0, missed: 2 });
    expect(summary.lastSevenDays).toHaveLength(7);
    expect(summary.lastSevenDays[6].done).toBe(1);
    expect(summary.lastSevenDays[6].total).toBe(1);
    expect(summary.lastSevenDays[5].skipped).toBe(1);
  });

  it('returns an all-zero summary when the patient has no active plan', async () => {
    patients.findById.mockResolvedValue({ _id: new Types.ObjectId(PATIENT_ID) } as never);
    plans.findActiveByPatient.mockResolvedValue([]);
    occurrences.findByPatientAndRange.mockResolvedValue([]);

    const result = await getAdherenceService(CLINIC_ID, PATIENT_ID);
    const summary = result.data;

    if ('error' in summary) throw new Error('expected an adherence summary');
    expect(summary.totals).toEqual({ pending: 0, sent: 0, done: 0, skipped: 0, missed: 0 });
    expect(summary.lastSevenDays.every(bucket => bucket.total === 0)).toBe(true);
  });
});
