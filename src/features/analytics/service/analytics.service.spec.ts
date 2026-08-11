import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/analytics/repository/analytics.repository', () => ({
  analyticsRepository: {
    listClinics: vi.fn(),
    countActivePatients: vi.fn(),
    countNewPatients: vi.fn(),
    countPatientsByLocale: vi.fn(),
    countOccurrencesByStatus: vi.fn(),
    countDeliveries: vi.fn(),
    countDeliveredByStatus: vi.fn(),
    countUndelivered: vi.fn(),
  },
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

import { analyticsRepository } from '@/features/analytics/repository/analytics.repository';
import {
  getClinicAnalyticsService,
  quarterRange,
} from '@/features/analytics/service/analytics.service';
import { ClinicAnalytics } from '@/features/analytics/types/analytics.types';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import {
  MINUTES_SAVED_PER_DELIVERED_REMINDER,
  MINUTES_SAVED_PER_PATIENT_ONBOARDED,
} from '@/shared/const/analytics.const';

const repo = vi.mocked(analyticsRepository);
const clinics = vi.mocked(clinicRepository);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const RANGE = quarterRange(2026, 3);

const clinic = () =>
  ({ _id: new mongoose.Types.ObjectId(CLINIC_ID), name: 'Gagua Clinic' }) as ClinicDocument;

const noDeliveries = {
  dispatched: 0,
  pushAttempted: 0,
  pushDelivered: 0,
  emailAttempted: 0,
  emailDelivered: 0,
};

const run = () => getClinicAnalyticsService(CLINIC_ID, RANGE);
const data = (result: Awaited<ReturnType<typeof run>>) => result.data as ClinicAnalytics;

describe('quarterRange', () => {
  it.each([
    [1, '2026-01-01', '2026-03-31'],
    [2, '2026-04-01', '2026-06-30'],
    [3, '2026-07-01', '2026-09-30'],
    [4, '2026-10-01', '2026-12-31'],
  ])('covers Q%i end to end', (quarter, from, to) => {
    const range = quarterRange(2026, quarter);

    expect(range.from.slice(0, 10)).toBe(from);
    expect(range.to.slice(0, 10)).toBe(to);
  });

  it('includes the final millisecond of the last day, so nothing falls between quarters', () => {
    expect(quarterRange(2026, 1).to).toBe('2026-03-31T23:59:59.999Z');
    expect(quarterRange(2026, 2).from).toBe('2026-04-01T00:00:00.000Z');
  });

  it('handles a leap February', () => {
    expect(quarterRange(2028, 1).to.slice(0, 10)).toBe('2028-03-31');
  });
});

describe('getClinicAnalyticsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clinics.findById.mockResolvedValue(clinic());
    repo.countActivePatients.mockResolvedValue(0);
    repo.countNewPatients.mockResolvedValue(0);
    repo.countPatientsByLocale.mockResolvedValue([]);
    repo.countOccurrencesByStatus.mockResolvedValue([]);
    repo.countDeliveries.mockResolvedValue(noDeliveries);
    /*
      By default every reminder reached its patient, so the cases below can be about what they
      are about. The exclusion has its own describe block at the end.
    */
    repo.countDeliveredByStatus.mockImplementation((...args) =>
      repo.countOccurrencesByStatus(...args)
    );
    repo.countUndelivered.mockResolvedValue(0);
  });

  it('404s for a clinic that does not exist', async () => {
    clinics.findById.mockResolvedValue(null);

    expect((await run()).status).toBe(404);
  });

  describe('adherence', () => {
    it('is confirmed over everything the patient could answer', async () => {
      repo.countOccurrencesByStatus.mockResolvedValue([
        { _id: 'done', count: 30 },
        { _id: 'skipped', count: 5 },
        { _id: 'missed', count: 5 },
      ]);

      expect(data(await run()).adherenceRate).toBe(0.75);
    });

    it('excludes reminders still awaiting an answer from the denominator', async () => {
      // A reminder sent an hour ago is not a patient ignoring their medication. Counting it would
      // make every report look worse the closer to the end of the quarter it was run.
      repo.countOccurrencesByStatus.mockResolvedValue([
        { _id: 'done', count: 10 },
        { _id: 'sent', count: 90 },
      ]);

      expect(data(await run()).adherenceRate).toBe(1);
    });

    it('is null rather than zero when nothing was due', async () => {
      expect(data(await run()).adherenceRate).toBeNull();
    });
  });

  describe('delivery rates', () => {
    it('reports each channel against its own attempts', async () => {
      repo.countDeliveries.mockResolvedValue({
        dispatched: 100,
        pushAttempted: 80,
        pushDelivered: 60,
        emailAttempted: 100,
        emailDelivered: 95,
      });

      const result = data(await run());

      expect(result.delivery.push.rate).toBe(0.75);
      expect(result.delivery.email.rate).toBe(0.95);
    });

    it('is null, not zero, when a channel was never attempted', async () => {
      // Rows dispatched before delivery was recorded. "No data" and "everything failed" are
      // different facts, and a 0% on a report would be read as the second.
      repo.countDeliveries.mockResolvedValue({ ...noDeliveries, dispatched: 40 });

      const result = data(await run());

      expect(result.delivery.push.rate).toBeNull();
      expect(result.delivery.email.rate).toBeNull();
    });
  });

  describe('the hours-saved estimate', () => {
    it('counts delivered reminders and onboarded patients, and exposes both assumptions', async () => {
      repo.countNewPatients.mockResolvedValue(4);
      repo.countDeliveries.mockResolvedValue({
        dispatched: 100,
        pushAttempted: 100,
        pushDelivered: 60,
        emailAttempted: 100,
        emailDelivered: 30,
      });

      const result = data(await run());

      const expectedMinutes =
        90 * MINUTES_SAVED_PER_DELIVERED_REMINDER + 4 * MINUTES_SAVED_PER_PATIENT_ONBOARDED;
      expect(result.hoursSaved.hours).toBeCloseTo(expectedMinutes / 60, 1);
      // The assumptions travel with the figure, or a clinic cannot check it.
      expect(result.hoursSaved.minutesPerReminder).toBe(MINUTES_SAVED_PER_DELIVERED_REMINDER);
      expect(result.hoursSaved.minutesPerPatient).toBe(MINUTES_SAVED_PER_PATIENT_ONBOARDED);
    });

    it('ignores reminders that were dispatched but never delivered', async () => {
      // One nobody received saved nobody anything.
      repo.countDeliveries.mockResolvedValue({
        dispatched: 500,
        pushAttempted: 500,
        pushDelivered: 0,
        emailAttempted: 500,
        emailDelivered: 0,
      });

      expect(data(await run()).hoursSaved.hours).toBe(0);
    });
  });

  describe('language split', () => {
    it('reports a share per locale', async () => {
      repo.countPatientsByLocale.mockResolvedValue([
        { _id: 'ka', count: 30 },
        { _id: 'en', count: 10 },
      ]);

      const result = data(await run());

      expect(result.locales).toEqual([
        { locale: 'ka', count: 30, share: 0.75 },
        { locale: 'en', count: 10, share: 0.25 },
      ]);
    });

    it('reports both languages even when one has nobody, so the split is never a single bar', async () => {
      repo.countPatientsByLocale.mockResolvedValue([{ _id: 'ka', count: 5 }]);

      const result = data(await run());

      expect(result.locales).toHaveLength(2);
      expect(result.locales[1]).toEqual({ locale: 'en', count: 0, share: 0 });
    });

    it('does not divide by zero for a clinic with no patients', async () => {
      const result = data(await run());

      expect(result.locales.every(split => split.share === 0)).toBe(true);
    });
  });

  it('folds the transient claim state into pending', async () => {
    // `sending` is held for the length of one sweep; from the patient's side nothing happened yet.
    repo.countOccurrencesByStatus.mockResolvedValue([
      { _id: 'pending', count: 3 },
      { _id: 'sending', count: 2 },
    ]);

    expect(data(await run()).reminders.pending).toBe(5);
  });
});

/**
 * A patient is not non-adherent for missing a reminder they never received, and this is a figure
 * a clinic may show a patient. The reminder totals still count every reminder the plan asked for
 * — only the ratio narrows, and the report says by how much.
 */
describe('getClinicAnalyticsService — adherence excludes reminders that reached nobody', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clinics.findById.mockResolvedValue(clinic());
    repo.countActivePatients.mockResolvedValue(0);
    repo.countNewPatients.mockResolvedValue(0);
    repo.countPatientsByLocale.mockResolvedValue([]);
    repo.countDeliveries.mockResolvedValue(noDeliveries);
    repo.countUndelivered.mockResolvedValue(0);
  });

  it('measures the ratio over delivered reminders only', async () => {
    // Ten asked for, four of them delivered: 2 done, 2 missed.
    repo.countOccurrencesByStatus.mockResolvedValue([
      { _id: 'done', count: 2 },
      { _id: 'missed', count: 8 },
    ]);
    repo.countDeliveredByStatus.mockResolvedValue([
      { _id: 'done', count: 2 },
      { _id: 'missed', count: 2 },
    ]);
    repo.countUndelivered.mockResolvedValue(6);

    const result = data(await run());

    expect(result.adherenceRate).toBe(0.5);
    expect(result.excludedUndelivered).toBe(6);
  });

  it('still counts every reminder the plan asked for in the totals', async () => {
    // The plan did ask for them, and that stays true whether or not anyone was told.
    repo.countOccurrencesByStatus.mockResolvedValue([
      { _id: 'done', count: 2 },
      { _id: 'missed', count: 8 },
    ]);
    repo.countDeliveredByStatus.mockResolvedValue([{ _id: 'done', count: 2 }]);

    expect(data(await run()).reminders.missed).toBe(8);
  });

  it('is null rather than zero when nothing delivered could be answered', async () => {
    // Not "0% adherence" — a clinic whose reminders all failed has no adherence data at all.
    repo.countOccurrencesByStatus.mockResolvedValue([{ _id: 'missed', count: 5 }]);
    repo.countDeliveredByStatus.mockResolvedValue([]);
    repo.countUndelivered.mockResolvedValue(5);

    expect(data(await run()).adherenceRate).toBeNull();
  });
});
