import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    countByStatusForPlan: vi.fn(),
    countUndeliveredForPlan: vi.fn(),
    findByPatientAndRange: vi.fn(),
  },
}));

import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { buildDayBuckets, sumTotals } from '@/features/care-plan/service/adherence.service';
import { clock } from '@/shared/lib/clock';

const occurrences = vi.mocked(reminderOccurrenceRepository);

const CLINIC = '507f1f77bcf86cd799439022';
const PATIENT = '507f1f77bcf86cd799439011';

const NOW = new Date('2026-08-09T12:00:00.000Z');

const plan = (id: string): CarePlanDocument =>
  ({ _id: new mongoose.Types.ObjectId(id) }) as CarePlanDocument;

const plans = [plan('507f1f77bcf86cd799439001')];

/**
 * A patient is not non-adherent for missing a reminder they never received. This is a figure a
 * clinic may show a patient, so a denominator built on doses nobody was told about would be
 * making an accusation out of a delivery failure.
 */
describe('sumTotals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    occurrences.countByStatusForPlan.mockResolvedValue([
      { _id: 'done', count: 4 },
      { _id: 'missed', count: 1 },
    ] as never);
    occurrences.countUndeliveredForPlan.mockResolvedValue(0);
  });

  it('sums the delivered reminders by status', async () => {
    const { totals } = await sumTotals(plans, CLINIC);

    expect(totals).toMatchObject({ done: 4, missed: 1 });
  });

  it('reports how many were excluded for reaching nobody', async () => {
    occurrences.countUndeliveredForPlan.mockResolvedValue(6);

    const { excludedUndelivered } = await sumTotals(plans, CLINIC);

    // Counted, not merely dropped: a denominator that quietly shrinks is its own untruth.
    expect(excludedUndelivered).toBe(6);
  });

  it('folds the transient sending claim into pending', async () => {
    occurrences.countByStatusForPlan.mockResolvedValue([
      { _id: 'pending', count: 2 },
      { _id: 'sending', count: 1 },
    ] as never);

    const { totals } = await sumTotals(plans, CLINIC);

    expect(totals.pending).toBe(3);
  });

  it('adds up across every active plan', async () => {
    const { excludedUndelivered } = await sumTotals(
      [plan('507f1f77bcf86cd799439001'), plan('507f1f77bcf86cd799439002')],
      CLINIC
    );

    expect(occurrences.countUndeliveredForPlan).toHaveBeenCalledTimes(2);
    expect(excludedUndelivered).toBe(0);
  });
});

describe('buildDayBuckets', () => {
  const occurrence = (over: Record<string, unknown>) =>
    ({
      dueAt: NOW,
      status: 'done',
      pushDelivered: true,
      emailDelivered: true,
      ...over,
    }) as never;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
  });

  it('counts a delivered reminder', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([occurrence({})]);

    const buckets = await buildDayBuckets(PATIENT, 'Asia/Tbilisi');

    expect(buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1);
  });

  /** The strip has to agree with the totals, or the week and the summary tell different stories. */
  it('leaves out one that reached nobody', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ pushDelivered: false, emailDelivered: false }),
    ]);

    const buckets = await buildDayBuckets(PATIENT, 'Asia/Tbilisi');

    expect(buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(0);
  });

  it('keeps one delivered by email alone', async () => {
    // The ordinary case: push needs a permission prompt most patients decline.
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ pushDelivered: false, emailDelivered: true }),
    ]);

    const buckets = await buildDayBuckets(PATIENT, 'Asia/Tbilisi');

    expect(buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1);
  });

  /**
   * `null` means the row predates delivery tracking. "We never looked" is a different claim from
   * "it did not arrive", and treating them alike would erase a plan's whole earlier history.
   */
  it('keeps one dispatched before delivery was recorded', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ pushDelivered: null, emailDelivered: null }),
    ]);

    const buckets = await buildDayBuckets(PATIENT, 'Asia/Tbilisi');

    expect(buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1);
  });

  it('keeps a pending reminder, which has not been tried yet', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ status: 'pending', pushDelivered: null, emailDelivered: null }),
    ]);

    const buckets = await buildDayBuckets(PATIENT, 'Asia/Tbilisi');

    expect(buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1);
  });
});
