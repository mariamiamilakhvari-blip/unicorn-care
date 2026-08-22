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

/*
  Activation emails the patient their whole plan. That is a network call to the mail provider and
  a read of its own, neither of which this spec is about — and left real it makes the outcome of
  an activation test depend on whether a socket happens to answer.
*/
vi.mock('@/features/notifications/service/email-dispatch.service', () => ({
  sendWelcomeEmailService: vi.fn(),
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { CreateCarePlanType } from '@/features/care-plan/validations/care-plan.validation';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { sendWelcomeEmailService } from '@/features/notifications/service/email-dispatch.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { resolveGuideForProcedure } from '@/features/recovery-guide/service/resolve-guide.service';
import { clock } from '@/shared/lib/clock';

import {
  activateCarePlanService,
  createCarePlanService,
  getAdherenceService,
  getByProcedureService,
  getCarePlanService,
  listOccurrencesService,
  regeneratePlansForTimezoneService,
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

/*
  Pinned just before the fixtures' own window. A rebuild only materialises occurrences that are
  still ahead of `clock.now()`, so a spec running against the real clock would generate nothing
  from dates in 2025 and every activation assertion would pass vacuously on an empty array.
*/
const NOW = new Date('2025-05-31T12:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'en' } as never);
  resolveGuide.mockResolvedValue(null);
  plans.create.mockResolvedValue(PLAN_ID);
  plans.updateById.mockResolvedValue(true);
  occurrences.deletePendingByCarePlan.mockResolvedValue(0);
  occurrences.insertMany.mockResolvedValue(0);
});

afterEach(() => vi.useRealTimers());

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

/**
 * A care plan is a clinical record like a patient is, so it sits behind the same subscription
 * wall. Without this a clinic whose trial had run out could no longer add a patient but could
 * still build and switch on a full reminder schedule for the ones they already had — the limit
 * was on the roster rather than on the product.
 */
describe('care plans behind the subscription wall', () => {
  /** A clinic seven days past the start of its trial, with everything else left alone. */
  // Relative to the pinned `NOW`, not to `Date.now()`: read at module load the latter is the real
  // clock, which sits far ahead of the fixtures and left the trial looking perfectly current.
  const lapsedClinic = { timezone: 'Europe/Berlin', locale: 'en', trialEndsAt: new Date(NOW.getTime() - 86_400_000) } as never;

  it('refuses to create a plan once the trial has expired', async () => {
    clinics.findById.mockResolvedValue(lapsedClinic);

    expect(await createCarePlanService(CLINIC_ID, createInput())).toEqual({
      data: { error: 'SUBSCRIPTION_INACTIVE' },
      status: 402,
    });
    expect(plans.create).not.toHaveBeenCalled();
  });

  /* 402, not 403: the request is valid and payment is the only thing missing. */
  it('answers a lapsed clinic with payment required, not forbidden', async () => {
    clinics.findById.mockResolvedValue(lapsedClinic);

    const { status } = await createCarePlanService(CLINIC_ID, createInput());

    expect(status).toBe(402);
  });

  /*
    Activation is the moment reminders are materialised and start being sent, so it is gated even
    though the plan already exists — a draft written before the trial ran out must not be able to
    switch on messaging afterwards.
  */
  it('refuses to activate an existing plan once the trial has expired', async () => {
    clinics.findById.mockResolvedValue(lapsedClinic);
    plans.findById.mockResolvedValue(planDoc());

    expect(await activateCarePlanService(CLINIC_ID, PLAN_ID)).toEqual({
      data: { error: 'SUBSCRIPTION_INACTIVE' },
      status: 402,
    });
    expect(occurrences.insertMany).not.toHaveBeenCalled();
    expect(plans.updateById).not.toHaveBeenCalled();
  });

  it('lets a clinic inside its trial create and activate as normal', async () => {
    clinics.findById.mockResolvedValue({
      timezone: 'Europe/Berlin',
      locale: 'en',
      trialEndsAt: new Date(Date.now() + 3 * 86_400_000),
    } as never);
    plans.findById.mockResolvedValue(planDoc());
    // `clearAllMocks` keeps implementations, so an earlier test's "one already exists" survives.
    plans.findByProcedureId.mockResolvedValue(null);

    expect((await createCarePlanService(CLINIC_ID, createInput())).status).toBe(201);
    expect((await activateCarePlanService(CLINIC_ID, PLAN_ID)).status).toBe(200);
  });
});

/**
 * P1 — a checkup is the one field a clinician types as a datetime, and `datetime-local` submits it
 * with no zone. It used to be stored as whatever the *server's* zone made of it, which on Vercel is
 * UTC: a Tbilisi clinic typing 13:00 stored 13:00Z, and the portal and every email printed 17:00.
 * The builder hid it by slicing the same UTC string back out and redisplaying the 13:00 typed.
 */
describe('checkup times are anchored in the clinic zone', () => {
  const TYPED = new Date('2025-06-20T13:00:00.000Z');

  function inputWithCheckup(): CreateCarePlanType {
    return { ...createInput(), checkups: [{ scheduledAt: TYPED, title: 'Follow-up', location: 'Room 3', remindHoursBefore: 24 }] };
  }

  it('stores the wall clock the clinic typed, not the raw UTC parse', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await createCarePlanService(CLINIC_ID, inputWithCheckup());

    // 13:00 in Tbilisi is 09:00 UTC. Storing 13:00Z is the four-hour shift this guards.
    const stored = plans.create.mock.calls[0][0].checkups as { scheduledAt: Date }[];
    expect(stored[0].scheduledAt.toISOString()).toBe('2025-06-20T09:00:00.000Z');
  });

  it('anchors on update too, so an edit does not re-shift a corrected appointment', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await updateCarePlanService(CLINIC_ID, PLAN_ID, inputWithCheckup());

    const patch = plans.updateById.mock.calls[0][2] as { checkups: { scheduledAt: Date }[] };
    expect(patch.checkups[0].scheduledAt.toISOString()).toBe('2025-06-20T09:00:00.000Z');
  });

  it('applies each clinic\'s own offset rather than one global assumption', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'America/New_York', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await createCarePlanService(CLINIC_ID, inputWithCheckup());

    const stored = plans.create.mock.calls[0][0].checkups as { scheduledAt: Date }[];
    expect(stored[0].scheduledAt.toISOString()).toBe('2025-06-20T17:00:00.000Z');
  });

  it('survives the builder round trip unchanged, so saving an untouched form is a no-op', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await createCarePlanService(CLINIC_ID, inputWithCheckup());
    const stored = plans.create.mock.calls[0][0].checkups as { scheduledAt: Date }[];

    // What the builder puts back in the input, then what the schema makes of it on resubmit.
    const redisplayed = clock.civilInZone(stored[0].scheduledAt, 'Asia/Tbilisi');
    expect(redisplayed).toBe('2025-06-20T13:00');

    plans.create.mockClear();
    await createCarePlanService(CLINIC_ID, {
      ...createInput(),
      checkups: [{ scheduledAt: new Date(`${redisplayed}Z`), title: 'Follow-up', location: 'Room 3', remindHoursBefore: 24 }],
    });
    const again = plans.create.mock.calls[0][0].checkups as { scheduledAt: Date }[];
    expect(again[0].scheduledAt.toISOString()).toBe(stored[0].scheduledAt.toISOString());
  });

  /*
    An unreadable clinic means an unknowable zone, so there is no honest instant to store. The
    subscription gate happens to refuse it first — it reads the same clinic and fails closed — so
    the visible code is 402 rather than 404. What matters here is that nothing is written on a
    path where the appointment could only have been guessed at.
  */
  it('writes nothing when the clinic — and so the zone — cannot be read', async () => {
    clinics.findById.mockResolvedValue(null);

    const { status } = await createCarePlanService(CLINIC_ID, inputWithCheckup());

    expect(status).not.toBe(201);
    expect(plans.create).not.toHaveBeenCalled();
  });
});

/**
 * P3 — `buildOccurrences` is deterministic from `plan.startsAt`, so it returns the plan's history
 * as well as its future, and `deletePendingByCarePlan` clears only `pending`. Rebuilding without a
 * filter therefore laid fresh `pending` duplicates over doses already sent and ticked off; the next
 * sweep marked everything past the grace window `missed`, inventing non-adherence for a patient who
 * had missed nothing.
 */
describe('a rebuild never re-materialises the past', () => {
  /** Mid-course: two of the four dose days are behind us, two are ahead. */
  const MID_COURSE = new Date('2025-06-03T12:00:00.000Z');

  it('inserts only occurrences still ahead of now when an active plan is edited', async () => {
    vi.setSystemTime(MID_COURSE);
    plans.findById.mockResolvedValue(planDoc({ status: 'active' }));

    await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    const inserted = occurrences.insertMany.mock.calls[0][0];
    expect(inserted.every(draft => draft.dueAt.getTime() >= MID_COURSE.getTime())).toBe(true);
    // 4 dose days, of which 06-02 and 06-03 08:00 Berlin have already gone.
    expect(inserted).toHaveLength(2);
  });

  it('writes nothing at all when every occurrence is behind us', async () => {
    vi.setSystemTime(new Date('2025-07-01T00:00:00.000Z'));
    plans.findById.mockResolvedValue(planDoc({ status: 'active' }));

    await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    expect(occurrences.deletePendingByCarePlan).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
    expect(occurrences.insertMany).not.toHaveBeenCalled();
  });

  it('guards the portal-triggered rebuild too, not only the clinic edit', async () => {
    vi.setSystemTime(MID_COURSE);
    plans.findActiveByPatient.mockResolvedValue([planDoc({ status: 'active' })]);

    await regeneratePlansForTimezoneService(PATIENT_ID, CLINIC_ID, 'Asia/Tbilisi');

    const inserted = occurrences.insertMany.mock.calls[0][0];
    expect(inserted.every(draft => draft.dueAt.getTime() >= MID_COURSE.getTime())).toBe(true);
  });
});

/**
 * P4 — editing a live plan re-runs activation so the materialised rows follow the edit, which meant
 * a corrected dosage or a moved appointment re-sent the patient the entire plan email they had
 * already read.
 */
describe('the welcome email is sent on activation, not on every edit', () => {
  it('sends when a draft becomes active', async () => {
    plans.findById.mockResolvedValue(planDoc({ status: 'draft' }));

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(sendWelcomeEmailService).toHaveBeenCalledTimes(1);
  });

  it('stays silent when an already-active plan is edited', async () => {
    plans.findById.mockResolvedValue(planDoc({ status: 'active' }));

    await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    expect(sendWelcomeEmailService).not.toHaveBeenCalled();
  });

  it('still rebuilds the occurrences it stayed silent about', async () => {
    plans.findById.mockResolvedValue(planDoc({ status: 'active' }));

    await updateCarePlanService(CLINIC_ID, PLAN_ID, createInput());

    expect(occurrences.deletePendingByCarePlan).toHaveBeenCalledWith(PLAN_ID, CLINIC_ID);
    expect(occurrences.insertMany).toHaveBeenCalled();
  });

  it('treats reactivating a finished plan as a new course of treatment', async () => {
    plans.findById.mockResolvedValue(planDoc({ status: 'completed' }));

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(sendWelcomeEmailService).toHaveBeenCalledTimes(1);
  });
});

/**
 * P2 — every occurrence ever generated carried the English copy table. Georgian is the product's
 * default locale, so `Take with food. 08:00` was landing on the phone of a patient whose portal,
 * emails and clinic are all Georgian. The translator plumbing existed from the start; there was
 * simply no non-English table for it to reach.
 */
describe('occurrence copy follows the patient language', () => {
  /** Reads the body the generator actually wrote onto a row, rather than the translator it was handed. */
  function medicationBody(): string {
    const inserted = occurrences.insertMany.mock.calls[0][0];
    return inserted.find(draft => draft.kind === 'medication')?.body ?? '';
  }

  it('writes Georgian copy for a Georgian patient', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'ka' } as never);
    patients.findById.mockResolvedValue({ timezone: '', locale: 'ka' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(medicationBody()).toContain('საკვებთან ერთად');
  });

  it('lets the patient language win over the clinic default', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'ka' } as never);
    patients.findById.mockResolvedValue({ timezone: '', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(medicationBody()).toContain('Take with food.');
  });

  /** A record written before the patient had a language of their own inherits the clinic's. */
  it('falls back to the clinic language when the patient has none', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'ka' } as never);
    patients.findById.mockResolvedValue({ timezone: '' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(medicationBody()).toContain('საკვებთან ერთად');
  });

  it('uses the same language for the guide lookup as for the copy', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'ka' } as never);
    patients.findById.mockResolvedValue({ timezone: '', locale: 'en' } as never);
    plans.findById.mockResolvedValue(planDoc());

    await activateCarePlanService(CLINIC_ID, PLAN_ID);

    expect(resolveGuide).toHaveBeenCalledWith(PROCEDURE_ID, CLINIC_ID, 'en');
  });

  /** The portal-triggered rebuild reads the patient too, rather than assuming the clinic's tongue. */
  it('translates the timezone rebuild in the patient language', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Europe/Berlin', locale: 'en' } as never);
    patients.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi', locale: 'ka' } as never);
    plans.findActiveByPatient.mockResolvedValue([planDoc({ status: 'active' })]);

    await regeneratePlansForTimezoneService(PATIENT_ID, CLINIC_ID, 'Asia/Tbilisi');

    expect(medicationBody()).toContain('საკვებთან ერთად');
  });
});
