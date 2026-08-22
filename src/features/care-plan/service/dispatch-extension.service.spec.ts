import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { findActivePlansNeedingExtension: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    findByPatientAndRange: vi.fn(),
    deletePendingByCarePlan: vi.fn(),
    insertMany: vi.fn(),
  },
}));
vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));
vi.mock('@/features/care-plan/service/occurrence-generator.service', () => ({
  buildOccurrences: vi.fn(),
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import { buildOccurrences } from '@/features/care-plan/service/occurrence-generator.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';

const plans = vi.mocked(carePlanRepository);
const occurrences = vi.mocked(reminderOccurrenceRepository);
const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);
const generate = vi.mocked(buildOccurrences);

const NOW = new Date('2026-08-09T00:00:00.000Z');
const PLAN_ID = '507f1f77bcf86cd799439011';

const plan = (rehabEndsAt: string): CarePlanDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PLAN_ID),
    patientId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
    clinicId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439033'),
    startsAt: new Date('2026-07-27T00:00:00.000Z'),
    rehabEndsAt: new Date(rehabEndsAt),
    status: 'active',
  }) as CarePlanDocument;

const draft = (dueAt: string) => ({ dueAt: new Date(dueAt) });

const inserted = () => occurrences.insertMany.mock.calls[0]?.[0] ?? [];

describe('extendActivePlansService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
    patients.findById.mockResolvedValue({ timezone: '' } as PatientDocument);
    occurrences.findByPatientAndRange.mockResolvedValue([]);
    occurrences.deletePendingByCarePlan.mockResolvedValue(0);
    occurrences.insertMany.mockResolvedValue(0);
    generate.mockReturnValue([]);
  });

  /**
   * The bug this guards against ran in production for days: a plan ending inside the trigger
   * window could never satisfy the "is anything generated past the trigger?" test, so it was
   * rebuilt every five minutes. Each rebuild regenerated the plan's whole history as fresh
   * `pending` rows, and the same sweep marked them `missed` — thousands of rows describing
   * nothing a patient ever did, and an adherence figure built on them.
   */
  describe('a plan that ends before the trigger point', () => {
    it('is never extended, however often the sweep runs', async () => {
      // Ends 18 August; the trigger point is 23 August. There is no future to generate.
      plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-08-18T00:00:00.000Z')]);

      const extended = await extendActivePlansService(NOW);

      expect(extended).toBe(0);
      expect(occurrences.insertMany).not.toHaveBeenCalled();
      expect(occurrences.deletePendingByCarePlan).not.toHaveBeenCalled();
    });

    it('does not even ask the database what it already has', async () => {
      // The plan's own end date settles it; probing occurrences would be wasted work per sweep.
      plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-08-18T00:00:00.000Z')]);

      await extendActivePlansService(NOW);

      expect(occurrences.findByPatientAndRange).not.toHaveBeenCalled();
    });

    it('still extends a plan that reaches past the trigger', async () => {
      plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-09-30T00:00:00.000Z')]);
      generate.mockReturnValue([draft('2026-08-20T08:00:00.000Z')] as never);

      expect(await extendActivePlansService(NOW)).toBe(1);
    });
  });

  /**
   * The second guard, and the one that holds whatever the trigger decides. `buildOccurrences` is
   * deterministic from the plan's start date, so it always returns the past as well as the future.
   */
  describe('backdated drafts are never inserted', () => {
    beforeEach(() => {
      plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-09-30T00:00:00.000Z')]);
    });

    it('inserts only what is still ahead', async () => {
      generate.mockReturnValue([
        draft('2026-07-28T08:00:00.000Z'),
        draft('2026-08-01T08:00:00.000Z'),
        draft('2026-08-20T08:00:00.000Z'),
        draft('2026-09-01T08:00:00.000Z'),
      ] as never);

      await extendActivePlansService(NOW);

      expect(inserted()).toHaveLength(2);
      expect(inserted().every(d => d.dueAt >= NOW)).toBe(true);
    });

    it('keeps a draft due exactly now — that one is still deliverable', async () => {
      generate.mockReturnValue([draft(NOW.toISOString())] as never);

      await extendActivePlansService(NOW);

      expect(inserted()).toHaveLength(1);
    });

    it('does not touch the plan when every draft is in the past', async () => {
      // Deleting the pending rows and inserting nothing would strip a patient's reminders.
      generate.mockReturnValue([
        draft('2026-07-28T08:00:00.000Z'),
        draft('2026-08-01T08:00:00.000Z'),
      ] as never);

      const extended = await extendActivePlansService(NOW);

      expect(extended).toBe(0);
      expect(occurrences.deletePendingByCarePlan).not.toHaveBeenCalled();
      expect(occurrences.insertMany).not.toHaveBeenCalled();
    });
  });

  it('skips a plan whose clinic no longer resolves, without throwing', async () => {
    plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-09-30T00:00:00.000Z')]);
    clinics.findById.mockResolvedValue(null);

    expect(await extendActivePlansService(NOW)).toBe(0);
  });

  it('leaves a plan alone when it already has occurrences past the trigger', async () => {
    plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-09-30T00:00:00.000Z')]);
    occurrences.findByPatientAndRange.mockResolvedValue([
      { carePlanId: new mongoose.Types.ObjectId(PLAN_ID) },
    ] as never);

    expect(await extendActivePlansService(NOW)).toBe(0);
  });
});

/**
 * The rolling extension was the one place a patient's move was quietly undone: it rebuilt the
 * next window against the *clinic's* zone, so a patient who had flown home went back to being
 * reminded on the clock of the city they left — three months after anyone was still watching.
 */
describe('the zone an extension rebuilds against', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as ClinicDocument);
    occurrences.findByPatientAndRange.mockResolvedValue([]);
    occurrences.deletePendingByCarePlan.mockResolvedValue(0);
    occurrences.insertMany.mockResolvedValue(0);
    plans.findActivePlansNeedingExtension.mockResolvedValue([plan('2026-12-31T00:00:00.000Z')]);
    generate.mockReturnValue([draft('2026-09-01T06:00:00.000Z')] as never);
  });

  it('uses the patient’s own zone when they have one', async () => {
    patients.findById.mockResolvedValue({ timezone: 'Europe/Amsterdam' } as PatientDocument);

    await extendActivePlansService(NOW);

    expect(generate).toHaveBeenCalledWith(
      expect.anything(),
      'Europe/Amsterdam',
      expect.any(Number)
    );
  });

  /** A blank field is inheritance, not a missing value — recovery starts at the clinic. */
  it('falls back to the clinic when the patient has not moved', async () => {
    patients.findById.mockResolvedValue({ timezone: '' } as PatientDocument);

    await extendActivePlansService(NOW);

    expect(generate).toHaveBeenCalledWith(expect.anything(), 'Asia/Tbilisi', expect.any(Number));
  });

  /** A patient row that cannot be read must not take the extension down with it. */
  it('still extends when the patient row is missing', async () => {
    patients.findById.mockResolvedValue(null);

    await extendActivePlansService(NOW);

    expect(generate).toHaveBeenCalledWith(expect.anything(), 'Asia/Tbilisi', expect.any(Number));
  });
});
