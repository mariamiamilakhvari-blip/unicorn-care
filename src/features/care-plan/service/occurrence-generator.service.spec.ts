import { Types } from 'mongoose';
import { describe, it, expect } from 'vitest';

import {
  CarePlanDocument,
  CheckupItem,
  MedicationItem,
  RehabTaskItem,
} from '@/features/care-plan/schema/care-plan.schema';
import { OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import { defaultOccurrenceTranslator } from '@/shared/const/occurrence-copy.const';

import { buildOccurrences } from './occurrence-generator.service';

const BERLIN = 'Europe/Berlin';
const GENERATED_AT = new Date('2025-01-01T00:00:00.000Z');

const PLAN_ID = new Types.ObjectId();
const PATIENT_ID = new Types.ObjectId();
const CLINIC_ID = new Types.ObjectId();

type PlanParts = {
  startsAt?: Date;
  medications?: MedicationItem[];
  rehabTasks?: RehabTaskItem[];
  checkups?: CheckupItem[];
};

function makePlan(parts: PlanParts): CarePlanDocument {
  const startsAt = parts.startsAt ?? new Date('2025-06-01T00:00:00.000Z');
  const plan = {
    _id: PLAN_ID,
    procedureId: new Types.ObjectId(),
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    startsAt,
    rehabEndsAt: new Date('2026-06-01T00:00:00.000Z'),
    status: 'draft',
    medications: parts.medications ?? [],
    rehabTasks: parts.rehabTasks ?? [],
    checkups: parts.checkups ?? [],
  };
  return plan as CarePlanDocument;
}

function medication(overrides: Partial<MedicationItem> = {}): MedicationItem {
  const item = {
    _id: new Types.ObjectId(),
    name: 'Amoxicillin',
    dosage: '500 mg',
    route: 'oral',
    timesOfDay: ['08:00'],
    startsOn: new Date('2025-06-02T00:00:00.000Z'),
    endsOn: new Date('2025-06-03T00:00:00.000Z'),
    withFood: true,
    instructions: 'take with a full glass of water',
    ...overrides,
  };
  return item as MedicationItem;
}

function rehabTask(overrides: Partial<RehabTaskItem> = {}): RehabTaskItem {
  const item = {
    _id: new Types.ObjectId(),
    title: 'Lymphatic massage',
    description: '',
    intensity: 'light',
    durationMinutes: 10,
    timesOfDay: ['09:00'],
    daysOfWeek: [1, 4],
    startsOn: new Date('2025-06-02T00:00:00.000Z'),
    endsOn: new Date('2025-06-08T00:00:00.000Z'),
    ...overrides,
  };
  return item as RehabTaskItem;
}

function checkup(overrides: Partial<CheckupItem> = {}): CheckupItem {
  const item = {
    _id: new Types.ObjectId(),
    scheduledAt: new Date('2025-06-10T12:00:00.000Z'),
    title: 'Follow-up with Dr Beridze',
    location: 'Clinic, 2nd floor',
    remindHoursBefore: 24,
    completedAt: null,
    ...overrides,
  };
  return item as CheckupItem;
}

function build(plan: CarePlanDocument, horizonDays?: number, translate?: OccurrenceTranslator) {
  return buildOccurrences(plan, BERLIN, horizonDays, translate, GENERATED_AT);
}

describe('buildOccurrences — medications', () => {
  it('emits one row per day per time of day, at the clinic-local wall clock', () => {
    const plan = makePlan({ medications: [medication({ timesOfDay: ['08:00', '14:00', '20:00'] })] });

    const drafts = build(plan);

    // 2 days × 3 times. June is CEST (UTC+2), so 08:00 local is 06:00Z.
    expect(drafts).toHaveLength(6);
    expect(drafts.map(draft => draft.dueAt.toISOString())).toEqual([
      '2025-06-02T06:00:00.000Z',
      '2025-06-02T12:00:00.000Z',
      '2025-06-02T18:00:00.000Z',
      '2025-06-03T06:00:00.000Z',
      '2025-06-03T12:00:00.000Z',
      '2025-06-03T18:00:00.000Z',
    ]);
  });

  it('renders the PRD 04 copy and never leaks the free-text instructions into the body', () => {
    const drafts = build(makePlan({ medications: [medication()] }));

    expect(drafts[0].title).toBe('Amoxicillin — 500 mg');
    expect(drafts[0].body).toBe('Take with food. 08:00');
    expect(drafts[0].body).not.toContain('full glass of water');
    expect(drafts[0].kind).toBe('medication');
    expect(drafts[0].intensity).toBeNull();
    expect(drafts[0].status).toBe('pending');
    expect(drafts[0].sourceItemId).toBeInstanceOf(Types.ObjectId);
  });

  it('carries plan tenancy onto every row', () => {
    const drafts = build(makePlan({ medications: [medication()] }));

    expect(drafts[0].carePlanId).toBe(PLAN_ID);
    expect(drafts[0].patientId).toBe(PATIENT_ID);
    expect(drafts[0].clinicId).toBe(CLINIC_ID);
  });
});

describe('buildOccurrences — rehab tasks', () => {
  it('only fires on the prescribed weekdays', () => {
    const plan = makePlan({ rehabTasks: [rehabTask()] });

    const drafts = build(plan);

    // Mon 2 June and Thu 5 June only — the window also covers Tue, Wed, Fri, Sat, Sun.
    expect(drafts.map(draft => draft.dueAt.toISOString())).toEqual([
      '2025-06-02T07:00:00.000Z',
      '2025-06-05T07:00:00.000Z',
    ]);
  });

  it('renders "Light · 10 min" and stores the intensity for the chip', () => {
    const drafts = build(makePlan({ rehabTasks: [rehabTask()] }));

    expect(drafts[0].title).toBe('Lymphatic massage');
    expect(drafts[0].body).toBe('Light · 10 min');
    expect(drafts[0].intensity).toBe('light');
  });

  it('drops the duration clause when the clinic did not prescribe one', () => {
    const drafts = build(makePlan({ rehabTasks: [rehabTask({ durationMinutes: 0 })] }));

    expect(drafts[0].body).toBe('Light');
  });
});

describe('buildOccurrences — checkups', () => {
  it('fires remindHoursBefore ahead of the appointment', () => {
    const drafts = build(makePlan({ checkups: [checkup()] }));

    expect(drafts).toHaveLength(1);
    expect(drafts[0].dueAt.toISOString()).toBe('2025-06-09T12:00:00.000Z');
    expect(drafts[0].title).toBe('Follow-up with Dr Beridze');
    expect(drafts[0].body).toBe('Tomorrow 14:00 · Clinic, 2nd floor');
  });

  it('says "Today" for a same-day reminder', () => {
    const drafts = build(makePlan({ checkups: [checkup({ remindHoursBefore: 2 })] }));

    expect(drafts[0].dueAt.toISOString()).toBe('2025-06-10T10:00:00.000Z');
    expect(drafts[0].body).toBe('Today 14:00 · Clinic, 2nd floor');
  });

  it('falls back to a numeric date beyond tomorrow and omits an empty location', () => {
    const drafts = build(
      makePlan({ checkups: [checkup({ remindHoursBefore: 72, location: '' })] })
    );

    expect(drafts[0].body).toBe('10/06 14:00');
  });
});

describe('buildOccurrences — horizon cap', () => {
  const longPlan = () =>
    makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-01T00:00:00.000Z'),
          endsOn: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ],
    });

  it('stops 90 days past startsAt by default instead of writing a year of rows', () => {
    const drafts = build(longPlan());

    // Inclusive of both the first day and the 90th day past `startsAt`.
    expect(drafts).toHaveLength(91);
    expect(drafts[drafts.length - 1].dueAt.toISOString()).toBe('2025-08-30T06:00:00.000Z');
  });

  it('honours an explicit horizon so the cron can roll the window forward', () => {
    const drafts = build(longPlan(), 7);

    expect(drafts).toHaveLength(8);
    expect(drafts[drafts.length - 1].dueAt.toISOString()).toBe('2025-06-08T06:00:00.000Z');
  });

  it('skips a checkup that falls past the horizon', () => {
    const plan = makePlan({ checkups: [checkup()] });

    expect(build(plan, 2)).toHaveLength(0);
  });
});

describe('buildOccurrences — DST', () => {
  it('keeps the prescribed wall-clock time across the spring-forward boundary', () => {
    const plan = makePlan({
      startsAt: new Date('2025-03-28T00:00:00.000Z'),
      medications: [
        medication({
          startsOn: new Date('2025-03-28T12:00:00.000Z'),
          endsOn: new Date('2025-03-31T12:00:00.000Z'),
          timesOfDay: ['08:00'],
        }),
      ],
    });

    const drafts = build(plan);

    // Berlin is UTC+1 until 30 March and UTC+2 after: the UTC instant shifts, 08:00 local does not.
    expect(drafts.map(draft => draft.dueAt.toISOString())).toEqual([
      '2025-03-28T07:00:00.000Z',
      '2025-03-29T07:00:00.000Z',
      '2025-03-30T06:00:00.000Z',
      '2025-03-31T06:00:00.000Z',
    ]);
  });
});

describe('buildOccurrences — translator', () => {
  it('takes every translatable word from the injected translator, not from next-intl', () => {
    const ka: OccurrenceTranslator = key => (key === 'withFood' ? 'მიიღეთ საკვებთან ერთად.' : key);

    const drafts = build(makePlan({ medications: [medication()] }), 90, ka);

    expect(drafts[0].body).toBe('მიიღეთ საკვებთან ერთად. 08:00');
  });

  it('ships an English default so callers without a locale still get readable copy', () => {
    expect(defaultOccurrenceTranslator('tomorrow')).toBe('Tomorrow');
    expect(defaultOccurrenceTranslator('withoutFood')).toBe('Take on an empty stomach.');
  });

  it('is deterministic — the same plan builds byte-identical rows', () => {
    const plan = makePlan({ medications: [medication()], checkups: [checkup()] });

    expect(build(plan)).toEqual(build(plan));
  });
});

describe('lead time before each dose', () => {
  it('fires every dose reminder the configured minutes early, one row per dose', () => {
    const plan = makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-02T00:00:00.000Z'),
          endsOn: new Date('2025-06-04T00:00:00.000Z'),
          timesOfDay: ['08:00'],
          remindMinutesBefore: 30,
        }),
      ],
    });

    const drafts = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT);

    // Three days, one dose each — a lead time shifts rows, it never adds a second notification.
    expect(drafts).toHaveLength(3);
    // 08:00 Berlin in June is 06:00Z; 30 minutes earlier is 05:30Z.
    expect(drafts.map(draft => draft.dueAt.toISOString())).toEqual([
      '2025-06-02T05:30:00.000Z',
      '2025-06-03T05:30:00.000Z',
      '2025-06-04T05:30:00.000Z',
    ]);
  });

  it('keeps the dose time in the body so an early reminder still says when to take it', () => {
    const plan = makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-02T00:00:00.000Z'),
          endsOn: new Date('2025-06-02T00:00:00.000Z'),
          timesOfDay: ['08:00'],
          remindMinutesBefore: 30,
        }),
      ],
    });

    const [draft] = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT);

    expect(draft.dueAt.toISOString()).toBe('2025-06-02T05:30:00.000Z');
    expect(draft.body).toContain('08:00');
  });

  /*
    Any lead the clinic sets, not a fixed menu of them: the generator multiplies the stored
    minutes, so 10, 15 and an arbitrary 37 are the same code path. Pinned explicitly because the
    trigger time is what the whole reminder pipeline is anchored to — every later stage, push and
    email alike, reads `dueAt` and never recomputes it.
  */
  it.each([
    [10, '2025-06-02T05:50:00.000Z'],
    [15, '2025-06-02T05:45:00.000Z'],
    [37, '2025-06-02T05:23:00.000Z'],
    [90, '2025-06-02T04:30:00.000Z'],
  ])('subtracts a %i-minute lead from the prescribed intake time', (lead, expected) => {
    const plan = makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-02T00:00:00.000Z'),
          endsOn: new Date('2025-06-02T00:00:00.000Z'),
          // 08:00 Berlin in June is 06:00Z.
          timesOfDay: ['08:00'],
          remindMinutesBefore: lead,
        }),
      ],
    });

    const [draft] = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT);

    expect(draft.dueAt.toISOString()).toBe(expected);
    // The intake time survives in the body, so an early reminder still says when to take it.
    expect(draft.body).toContain('08:00');
    /*
      And on the row itself, whatever the lead. This is what the reminder email prints; without
      it the only time the email could reach was `dueAt`, which is early by exactly this lead.
    */
    expect(draft.scheduledAt?.toISOString()).toBe('2025-06-02T06:00:00.000Z');
  });

  it('fires at the dose time when the lead is 0, so old plans are unchanged', () => {
    const plan = makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-02T00:00:00.000Z'),
          endsOn: new Date('2025-06-02T00:00:00.000Z'),
          timesOfDay: ['08:00'],
          remindMinutesBefore: 0,
        }),
      ],
    });

    const [draft] = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT);

    expect(draft.dueAt.toISOString()).toBe('2025-06-02T06:00:00.000Z');
  });

  it('carries a lead that crosses midnight back into the previous day', () => {
    const plan = makePlan({
      medications: [
        medication({
          startsOn: new Date('2025-06-02T00:00:00.000Z'),
          endsOn: new Date('2025-06-02T00:00:00.000Z'),
          timesOfDay: ['00:15'],
          remindMinutesBefore: 30,
        }),
      ],
    });

    const [draft] = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT);

    // 00:15 Berlin on 2 June is 22:15Z on 1 June; 30 minutes earlier is 21:45Z on 1 June.
    expect(draft.dueAt.toISOString()).toBe('2025-06-01T21:45:00.000Z');
  });
});

describe('expected-sign reminders from the recovery guide', () => {
  const SIGN_ID = new Types.ObjectId();

  it('fires on the day of recovery the sign begins, counted off the plan start', () => {
    const plan = makePlan({ startsAt: new Date('2025-06-01T00:00:00.000Z') });

    const drafts = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT, {
      expected: [{ _id: SIGN_ID, title: 'Swelling', fromDay: 3 }],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('guide');
    expect(drafts[0].title).toBe('Swelling');
    expect(drafts[0].sourceItemId).toBe(SIGN_ID);
    // Day 3 after 01 June, at 09:00 Berlin = 07:00Z.
    expect(drafts[0].dueAt.toISOString()).toBe('2025-06-04T07:00:00.000Z');
  });

  it('writes nothing when the clinic has no guide, so activation still works', () => {
    const plan = makePlan({ startsAt: new Date('2025-06-01T00:00:00.000Z') });

    expect(
      buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT, null)
    ).toHaveLength(0);
  });

  it('drops a sign whose day falls beyond the generation horizon', () => {
    const plan = makePlan({ startsAt: new Date('2025-06-01T00:00:00.000Z') });

    const drafts = buildOccurrences(plan, BERLIN, 90, defaultOccurrenceTranslator, GENERATED_AT, {
      expected: [{ _id: SIGN_ID, title: 'Late sign', fromDay: 200 }],
    });

    expect(drafts).toHaveLength(0);
  });
});
