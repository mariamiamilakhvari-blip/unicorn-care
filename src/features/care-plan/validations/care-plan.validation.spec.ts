import { describe, expect, it } from 'vitest';

import {
  CreateCarePlanType,
  isUntouchedCheckupRow,
  isUntouchedMedicationRow,
  isUntouchedRehabRow,
  UpdateCarePlanSchema,
} from '@/features/care-plan/validations/care-plan.validation';

const PLAN = {
  startsAt: '2026-08-01T00:00:00.000Z',
  rehabEndsAt: '2026-09-01T00:00:00.000Z',
  medications: [],
  checkups: [],
};

/** What "add task" appends: the shape a clinician sees before typing anything. */
const untouchedTask = () => ({
  title: '',
  description: '',
  intensity: 'light',
  durationMinutes: 10,
  timesOfDay: ['09:00'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startsOn: '',
  endsOn: '',
  remindMinutesBefore: 0,
});

const realTask = () => ({
  ...untouchedTask(),
  title: 'გაიკეთეთ მასაჟი',
  startsOn: '2026-08-02T00:00:00.000Z',
  endsOn: '2026-08-20T00:00:00.000Z',
});

const parse = (rehabTasks: unknown[]) => UpdateCarePlanSchema.safeParse({ ...PLAN, rehabTasks });
const tasksIn = (result: ReturnType<typeof parse>) =>
  result.success ? (result.data as CreateCarePlanType).rehabTasks : [];

/**
 * Rehabilitation is optional — plenty of plans are medication and a checkup. "Add task" appends a
 * blank block, so a clinician who adds one and changes their mind must not be left with a plan
 * that cannot be saved.
 */
describe('rehab tasks are optional', () => {
  it('accepts a plan with no rehabilitation at all', () => {
    expect(parse([]).success).toBe(true);
  });

  it('accepts a plan whose rehabTasks key is absent entirely', () => {
    expect(UpdateCarePlanSchema.safeParse(PLAN).success).toBe(true);
  });

  it('drops a block the clinician opened and never filled in', () => {
    const result = parse([untouchedTask()]);

    expect(result.success).toBe(true);
    expect(tasksIn(result)).toHaveLength(0);
  });

  it('drops several untouched blocks at once', () => {
    const result = parse([untouchedTask(), untouchedTask(), untouchedTask()]);

    expect(result.success).toBe(true);
    expect(tasksIn(result)).toHaveLength(0);
  });

  it('keeps a real task and drops the blank one beside it', () => {
    const result = parse([realTask(), untouchedTask()]);

    expect(result.success).toBe(true);
    expect(tasksIn(result)).toHaveLength(1);
    expect(tasksIn(result)[0].title).toBe('გაიკეთეთ მასაჟი');
  });

  it('drops a blank block that sits before a real one, without shifting the real one away', () => {
    const result = parse([untouchedTask(), realTask()]);

    expect(tasksIn(result)).toHaveLength(1);
    expect(tasksIn(result)[0].title).toBe('გაიკეთეთ მასაჟი');
  });

  /**
   * The line that matters. A half-filled row is a clinician who started describing real work and
   * was interrupted — discarding it silently would activate a plan missing a task somebody meant
   * to prescribe, and nobody would be told. It stays, and it fails, which is the honest outcome.
   */
  describe('a partially filled row is never discarded', () => {
    it.each([
      ['a title but no dates', { title: 'Massage' }],
      ['dates but no title', { startsOn: '2026-08-02T00:00:00.000Z', endsOn: '2026-08-20T00:00:00.000Z' }],
      ['only a description', { description: 'twice a day, gently' }],
      ['only a start date', { startsOn: '2026-08-02T00:00:00.000Z' }],
    ])('rejects the plan when a row has %s', (_label, partial) => {
      const result = parse([{ ...untouchedTask(), ...partial }]);

      expect(result.success).toBe(false);
    });
  });

  it('treats whitespace as untouched, since a stray space is not clinical intent', () => {
    const result = parse([{ ...untouchedTask(), title: '   ', description: '  ' }]);

    expect(result.success).toBe(true);
    expect(tasksIn(result)).toHaveLength(0);
  });
});

/**
 * The form uses this predicate at its resolver; the API schema applies the same rule. Both sides
 * need it — one decides whether the clinician sees red `Required` labels, the other whether the
 * request is accepted. A block that cleared on submit but kept shouting on screen would be worse
 * than either alone.
 */
describe('isUntouchedRehabRow', () => {
  it.each([
    ['a wholly empty row', {}],
    ['blank strings', { title: '', description: '', startsOn: '', endsOn: '' }],
    ['whitespace only', { title: '  ', description: '\t', startsOn: '', endsOn: '' }],
  ])('treats %s as untouched', (_label, row) => {
    expect(isUntouchedRehabRow(row)).toBe(true);
  });

  it.each([
    ['a title', { title: 'Massage' }],
    ['a description', { description: 'gently, twice a day' }],
    ['a start date', { startsOn: '2026-08-02' }],
    ['an end date', { endsOn: '2026-08-20' }],
  ])('treats a row with %s as real work', (_label, row) => {
    // Interrupted work, not a mistake to erase — discarding it would delete clinical intent.
    expect(isUntouchedRehabRow(row)).toBe(false);
  });
});

/**
 * All three sections behave identically, because all three append a blank block and all three are
 * optional. Pinned together so a change to one cannot quietly diverge from the others.
 */
describe('medications and checkups follow the same rule', () => {
  const untouchedMedication = () => ({
    name: '',
    dosage: '',
    route: 'oral',
    timesOfDay: ['08:00'],
    startsOn: '',
    endsOn: '',
    withFood: false,
    instructions: '',
    remindMinutesBefore: 0,
  });

  const untouchedCheckup = () => ({
    scheduledAt: '',
    title: '',
    location: '',
    remindHoursBefore: 24,
  });

  it('drops an untouched medication block', () => {
    const result = UpdateCarePlanSchema.safeParse({
      ...PLAN,
      medications: [untouchedMedication()],
      rehabTasks: [],
    });

    expect(result.success).toBe(true);
    expect(result.success && (result.data as CreateCarePlanType).medications).toHaveLength(0);
  });

  it('drops an untouched checkup block', () => {
    const result = UpdateCarePlanSchema.safeParse({
      ...PLAN,
      rehabTasks: [],
      checkups: [untouchedCheckup()],
    });

    expect(result.success).toBe(true);
    expect(result.success && (result.data as CreateCarePlanType).checkups).toHaveLength(0);
  });

  it('accepts a plan where every section is one blank block', () => {
    // The exact state a clinician reaches by pressing all three "add" buttons and then stopping.
    const result = UpdateCarePlanSchema.safeParse({
      ...PLAN,
      medications: [untouchedMedication()],
      rehabTasks: [untouchedTask()],
      checkups: [untouchedCheckup()],
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['a medication with a name but no dates', { name: 'Amoxicillin' }],
    ['a medication with a dosage only', { dosage: '500 mg' }],
  ])('still rejects %s', (_label, partial) => {
    const result = UpdateCarePlanSchema.safeParse({
      ...PLAN,
      medications: [{ ...untouchedMedication(), ...partial }],
      rehabTasks: [],
    });

    expect(result.success).toBe(false);
  });

  it('still rejects a checkup with a title but no date', () => {
    const result = UpdateCarePlanSchema.safeParse({
      ...PLAN,
      rehabTasks: [],
      checkups: [{ ...untouchedCheckup(), title: 'Six week review' }],
    });

    expect(result.success).toBe(false);
  });

  describe('the predicates ignore defaulted fields', () => {
    it.each([
      ['medication', isUntouchedMedicationRow, untouchedMedication()],
      ['checkup', isUntouchedCheckupRow, untouchedCheckup()],
    ])('treats an untouched %s row as blank despite its defaults', (_label, isBlank, row) => {
      // route, timesOfDay, remindHoursBefore all carry values on a row nobody has typed into.
      expect(isBlank(row)).toBe(true);
    });

    it('does not treat a real medication as blank', () => {
      expect(isUntouchedMedicationRow({ ...untouchedMedication(), name: 'Amoxicillin' })).toBe(false);
    });

    it('does not treat a real checkup as blank', () => {
      expect(isUntouchedCheckupRow({ ...untouchedCheckup(), scheduledAt: '2026-08-20' })).toBe(false);
    });
  });
});
