import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-log/repository/recovery-log.repository', () => ({
  recoveryLogRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByPatient: vi.fn(),
    findByPlanAndDay: vi.fn(),
    updateById: vi.fn(),
  },
}));
vi.mock('@/features/recovery-log/repository/patient-photo.repository', () => ({
  patientPhotoRepository: { findById: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { findActiveByPatient: vi.fn() },
}));
vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { RecoveryLogDocument } from '@/features/recovery-log/schema/recovery-log.schema';
import {
  createRecoveryLogService,
  getRecoveryTrendService,
} from '@/features/recovery-log/service/recovery-log.service';
import { clock } from '@/shared/lib/clock';

const logs = vi.mocked(recoveryLogRepository);
const photos = vi.mocked(patientPhotoRepository);
const plans = vi.mocked(carePlanRepository);
const clinics = vi.mocked(clinicRepository);

const PATIENT = '507f1f77bcf86cd799439011';
const CLINIC = '507f1f77bcf86cd799439022';
const PLAN = '507f1f77bcf86cd799439033';
const PHOTO = '507f1f77bcf86cd799439044';
const OTHER = '507f1f77bcf86cd7994390aa';

/** Day 0 is 1 August; "now" is the evening of 8 August in Tbilisi, so day 7. */
const NOW = new Date('2026-08-08T16:00:00.000Z');

const plan = (): CarePlanDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PLAN),
    startsAt: new Date('2026-08-01T06:00:00.000Z'),
    rehabEndsAt: new Date('2026-10-01T00:00:00.000Z'),
    checkups: [],
  }) as unknown as CarePlanDocument;

const log = (over: Partial<RecoveryLogDocument> = {}): RecoveryLogDocument =>
  ({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439055'),
    patientId: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    carePlanId: new mongoose.Types.ObjectId(PLAN),
    loggedAt: NOW,
    dayIndex: 7,
    painLevel: 4,
    swelling: 'mild',
    mood: null,
    note: '',
    photoIds: [],
    ...over,
  }) as RecoveryLogDocument;

const input = { painLevel: 4, swelling: 'mild' as const, mood: null, note: '', photoIds: [] };

describe('createRecoveryLogService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    plans.findActiveByPatient.mockResolvedValue([plan()]);
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
    logs.findByPlanAndDay.mockResolvedValue(null);
    logs.create.mockResolvedValue('new-id');
    logs.findById.mockResolvedValue(log());
    logs.updateById.mockResolvedValue(true);
  });

  it('files the entry and answers 201', async () => {
    const { status } = await createRecoveryLogService(PATIENT, CLINIC, input);

    expect(status).toBe(201);
  });

  /**
   * The x-axis of the clinic's chart. Computed server-side from the plan's start date, because a
   * client-supplied value would let a request file a point on any day of its recovery, including
   * days that have not happened.
   */
  it('computes the day index from the plan, in the clinic timezone', async () => {
    await createRecoveryLogService(PATIENT, CLINIC, input);

    expect(logs.create.mock.calls[0][0].dayIndex).toBe(7);
  });

  it('refuses when the patient has no active plan', async () => {
    plans.findActiveByPatient.mockResolvedValue([]);

    const { status, data } = await createRecoveryLogService(PATIENT, CLINIC, input);

    expect(status).toBe(409);
    expect(data).toEqual({ error: 'NO_ACTIVE_PLAN' });
    expect(logs.create).not.toHaveBeenCalled();
  });

  /**
   * Two rows for one day would put a vertical line in the chart and make the day's real value
   * ambiguous. A patient correcting a reading is amending one point, not adding another.
   */
  describe('re-reporting the same day', () => {
    it('replaces the entry rather than adding a second', async () => {
      logs.findByPlanAndDay.mockResolvedValue(log({ painLevel: 8 }));

      const { status } = await createRecoveryLogService(PATIENT, CLINIC, input);

      expect(status).toBe(200);
      expect(logs.create).not.toHaveBeenCalled();
      expect(logs.updateById.mock.calls[0][1]).toMatchObject({ painLevel: 4 });
    });

    it('keeps photographs already attached to that day', async () => {
      // A correction to the pain score must not silently drop a photograph already filed.
      const existing = new mongoose.Types.ObjectId(PHOTO);
      logs.findByPlanAndDay.mockResolvedValue(log({ photoIds: [existing] }));

      await createRecoveryLogService(PATIENT, CLINIC, input);

      expect(logs.updateById.mock.calls[0][1].photoIds).toHaveLength(1);
    });
  });

  describe('attached photographs', () => {
    it('accepts one belonging to this patient', async () => {
      photos.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(PHOTO),
        patientId: new mongoose.Types.ObjectId(PATIENT),
      } as never);

      const { status } = await createRecoveryLogService(PATIENT, CLINIC, {
        ...input,
        photoIds: [PHOTO],
      });

      expect(status).toBe(201);
      expect(logs.create.mock.calls[0][0].photoIds).toHaveLength(1);
    });

    /** Otherwise a request could attach somebody else's photograph by guessing an id. */
    it('refuses one belonging to another patient', async () => {
      photos.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(PHOTO),
        patientId: new mongoose.Types.ObjectId(OTHER),
      } as never);

      const { status, data } = await createRecoveryLogService(PATIENT, CLINIC, {
        ...input,
        photoIds: [PHOTO],
      });

      expect(status).toBe(404);
      expect(data).toEqual({ error: 'PHOTO_NOT_FOUND' });
      expect(logs.create).not.toHaveBeenCalled();
    });

    it('refuses an id that matches nothing', async () => {
      photos.findById.mockResolvedValue(null);

      const { status } = await createRecoveryLogService(PATIENT, CLINIC, {
        ...input,
        photoIds: [PHOTO],
      });

      expect(status).toBe(404);
    });
  });
});

describe('getRecoveryTrendService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
    plans.findActiveByPatient.mockResolvedValue([plan()]);
  });

  it('returns the points in the order the chart plots them', async () => {
    logs.findByPatient.mockResolvedValue([log({ dayIndex: 1 }), log({ dayIndex: 4 })]);

    const { data } = await getRecoveryTrendService(PATIENT, CLINIC);

    expect('points' in data && data.points.map(point => point.dayIndex)).toEqual([1, 4]);
  });

  /** "What did it look like around the time we saw them" is most of what a clinic asks here. */
  it('marks the checkup days on the axis', async () => {
    logs.findByPatient.mockResolvedValue([]);
    plans.findActiveByPatient.mockResolvedValue([
      {
        ...plan(),
        checkups: [
          { scheduledAt: new Date('2026-08-15T09:00:00.000Z') },
          { scheduledAt: new Date('2026-08-08T09:00:00.000Z') },
        ],
      } as unknown as CarePlanDocument,
    ]);

    const { data } = await getRecoveryTrendService(PATIENT, CLINIC);

    expect('checkupDays' in data && data.checkupDays).toEqual([7, 14]);
  });

  it('is empty rather than absent for a patient who has reported nothing', async () => {
    logs.findByPatient.mockResolvedValue([]);

    const { data, status } = await getRecoveryTrendService(PATIENT, CLINIC);

    expect(status).toBe(200);
    expect('points' in data && data.points).toEqual([]);
  });
});
