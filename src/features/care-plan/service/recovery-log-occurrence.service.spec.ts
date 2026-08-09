import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import {
  buildRecoveryLogOccurrences,
  recoveryLogDays,
} from '@/features/care-plan/service/recovery-log-occurrence.service';
import { OCCURRENCE_EN_COPY } from '@/shared/const/occurrence-copy.const';
import { clock } from '@/shared/lib/clock';

const START = new Date('2026-08-01T00:00:00.000Z');
const GENERATED = new Date('2026-08-01T06:00:00.000Z');

const plan = (over: Partial<CarePlanDocument> = {}): CarePlanDocument =>
  ({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    patientId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
    clinicId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439033'),
    startsAt: START,
    rehabEndsAt: new Date('2026-10-30T00:00:00.000Z'),
    recoveryLogEnabled: true,
    ...over,
  }) as CarePlanDocument;

const context = (over: Partial<CarePlanDocument> = {}) => ({
  plan: plan(over),
  timezone: 'Asia/Tbilisi',
  horizonEnd: new Date('2026-12-31T00:00:00.000Z'),
  generatedAt: GENERATED,
  t: (key: keyof typeof OCCURRENCE_EN_COPY) => OCCURRENCE_EN_COPY[key],
});

describe('recoveryLogDays', () => {
  /**
   * The cadence decreases because the useful signal does. Week one is where a complication shows
   * up; by week six the question is only whether the curve still points the right way.
   */
  it('asks daily through the first week', () => {
    expect(recoveryLogDays(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('drops to every third day for weeks two to four', () => {
    // Day 7 is the last daily one; the 3-day band then runs from it.
    expect(recoveryLogDays(20)).toEqual([1, 2, 3, 4, 5, 6, 7, 10, 13, 16, 19]);
  });

  it('drops to weekly after week four', () => {
    const days = recoveryLogDays(60);

    expect(days).toContain(28);
    expect(days.filter(day => day > 28)).toEqual([35, 42, 49, 56]);
  });

  /**
   * Walking forward rather than filtering on `day % everyDays` is what stops a double prompt at
   * each band edge — day 28 satisfies both a 3-day and a 7-day rule.
   */
  it('never repeats a day at a band boundary', () => {
    const days = recoveryLogDays(120);

    expect(new Set(days).size).toBe(days.length);
  });

  it('skips the day of the operation', () => {
    // A patient still on the ward is not reporting a recovery trend.
    expect(recoveryLogDays(3)).not.toContain(0);
  });

  it('asks nothing for a plan with no days in it', () => {
    expect(recoveryLogDays(0)).toEqual([]);
  });
});

describe('buildRecoveryLogOccurrences', () => {
  it('produces nothing unless the plan asks for check-ins', () => {
    // Off by default: turning it on adds a recurring prompt to a patient's phone, which is the
    // clinic's decision to make per plan and not a platform default to flip for everybody.
    expect(buildRecoveryLogOccurrences(context({ recoveryLogEnabled: false }))).toEqual([]);
  });

  it('produces nothing for a plan whose field predates the feature', () => {
    expect(buildRecoveryLogOccurrences(context({ recoveryLogEnabled: undefined }))).toEqual([]);
  });

  it('generates one prompt per cadence day', () => {
    const drafts = buildRecoveryLogOccurrences(context());

    expect(drafts).toHaveLength(recoveryLogDays(90).length);
  });

  it('tags every draft as a recovery_log', () => {
    expect(buildRecoveryLogOccurrences(context()).every(d => d.kind === 'recovery_log')).toBe(true);
  });

  /** Every other kind points at the subdocument that produced it; this one has none. */
  it('points sourceItemId at the plan itself', () => {
    const [first] = buildRecoveryLogOccurrences(context());

    expect(first.sourceItemId.toString()).toBe(first.carePlanId.toString());
  });

  /**
   * A lock-screen preview is readable by whoever is holding the phone, so the prompt says nothing
   * about the procedure, the clinic or the patient's condition.
   */
  it('carries no clinical detail in the body', () => {
    expect(buildRecoveryLogOccurrences(context()).every(draft => draft.body === '')).toBe(true);
  });

  it('lands each prompt in the clinic evening, local time', () => {
    const [first] = buildRecoveryLogOccurrences(context());

    expect(clock.hourInZone(first.dueAt, 'Asia/Tbilisi')).toBe(19);
  });

  it('stops at the end of the plan', () => {
    const drafts = buildRecoveryLogOccurrences(context({ rehabEndsAt: new Date('2026-08-06T00:00:00.000Z') }));

    expect(drafts).toHaveLength(5);
  });

  it('generates nothing past the horizon', () => {
    const short = { ...context(), horizonEnd: new Date('2026-08-05T00:00:00.000Z') };

    expect(buildRecoveryLogOccurrences(short).length).toBeLessThan(5);
  });

  it('generates nothing for a plan that ends the day it starts', () => {
    expect(buildRecoveryLogOccurrences(context({ rehabEndsAt: START }))).toEqual([]);
  });
});
