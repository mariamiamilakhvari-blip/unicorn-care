 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findAllByClinic: vi.fn() },
}));

/* Cancellation reaches the payment provider before it touches our own record. */
vi.mock('@/shared/lib/dodo-client', () => ({
  dodoClient: { cancelSubscription: vi.fn() },
}));

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import {
  canClinicDispatch,
  canClinicWrite,
  cancelSubscriptionService,
  checkPatientSeat,
  getSubscriptionService,
  resolveGrace,
  resolveStatus,
} from '@/features/clinic/service/subscription.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { STANDARD_PATIENT_LIMIT, TRIAL_PATIENT_LIMIT } from '@/shared/const/plan.const';
import { dodoClient } from '@/shared/lib/dodo-client';

const CLINIC_ID = '507f1f77bcf86cd799439011';

const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);
const dodo = vi.mocked(dodoClient);

type ClinicOverrides = Partial<{
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  planRenewsAt: Date | null;
  dodoSubscriptionId: string | null;
  subscriptionEndedAt: Date | null;
}>;

function clinicDoc(overrides: ClinicOverrides = {}) {
  return {
    _id: CLINIC_ID,
    plan: 'trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 3 * 86_400_000),
    planRenewsAt: null,
    dodoSubscriptionId: null,
    subscriptionEndedAt: null,
    timezone: 'Asia/Tbilisi',
    ...overrides,
  } as never;
}

/** `count` active patients, plus one archived to prove archived rows never occupy a seat. */
function roster(count: number) {
  const items = Array.from({ length: count }, (_, index) => ({
    _id: `active-${index}`,
    isArchived: false,
  }));
  items.push({ _id: 'archived', isArchived: true } as never);
  return { items, total: items.length } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  clinics.findById.mockResolvedValue(clinicDoc());
  patients.findAllByClinic.mockResolvedValue(roster(0));
  clinics.updateById.mockResolvedValue(true);
  dodo.cancelSubscription.mockResolvedValue({ ok: true } as never);
});

describe('resolveStatus', () => {
  it('keeps a trial alive before its end date', () => {
    const clinic = clinicDoc({ trialEndsAt: new Date(Date.now() + 86_400_000) });
    expect(resolveStatus(clinic, new Date())).toBe('trialing');
  });

  /** Derived on read, so an expired trial cannot survive because no scheduled job ran. */
  it('expires a trial once the date has passed, with no job required', () => {
    const clinic = clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) });
    expect(resolveStatus(clinic, new Date())).toBe('expired');
  });

  /**
   * Regression: clinics created before subscriptions existed have no `subscriptionStatus`, and
   * Mongoose defaults do not backfill existing rows. Reading it raw made `canWrite` false and
   * locked every one of them out of adding patients.
   */
  it('grandfathers a clinic that predates the subscription fields', () => {
    const legacy = { _id: CLINIC_ID, timezone: 'Asia/Tbilisi' } as never;
    expect(resolveStatus(legacy, new Date())).toBe('trialing');
  });

  it('never downgrades a paid subscription', () => {
    const clinic = clinicDoc({
      subscriptionStatus: 'active',
      plan: 'standard',
      trialEndsAt: new Date(Date.now() - 86_400_000),
    });
    expect(resolveStatus(clinic, new Date())).toBe('active');
  });
});

describe('checkPatientSeat — limits', () => {
  it('allows a trial clinic below the 5-patient limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT - 1));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });

  it('refuses once the trial limit is reached', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'PATIENT_LIMIT_REACHED',
    });
  });

  it('refuses a Standard clinic at 50 active patients', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(STANDARD_PATIENT_LIMIT));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'PATIENT_LIMIT_REACHED',
    });
  });

  /*
    Premium is uncapped, and the check exits before it counts anything. Asserting that the roster
    is never read is the part that matters: a plan with no limit must have no cap check at all, not
    a cap check that happens to pass. Counting would also put a 5000-row read in front of every
    patient a large clinic adds, to reach a branch whose answer is already known.
  */
  it('never limits Premium, and does not even count the roster', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'premium', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(5000));

    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
    expect(patients.findAllByClinic).not.toHaveBeenCalled();
  });

  /** Archiving is how a clinic frees a seat, so archived rows must not be counted. */
  it('does not count archived patients against the limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT - 1));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });
});

describe('checkPatientSeat — subscription state', () => {
  it('refuses when the trial has expired, before counting anything', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );

    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
    expect(patients.findAllByClinic).not.toHaveBeenCalled();
  });

  it('refuses a past_due subscription', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'past_due' })
    );
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
  });

  it('refuses a cancelled subscription', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'cancelled' })
    );
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
  });
});

describe('getSubscriptionService', () => {
  it('reports usage against the plan limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(3));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({
      plan: 'trial',
      status: 'trialing',
      activePatients: 3,
      patientLimit: TRIAL_PATIENT_LIMIT,
      isAtPatientLimit: false,
      canWrite: true,
    });
  });

  it('flags the limit and blocks writes once the trial expires', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ status: 'expired', isAtPatientLimit: true, canWrite: false });
  });

  it('reports Premium as unlimited rather than at a limit', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'premium', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(500));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ patientLimit: null, isAtPatientLimit: false });
  });
});

describe('canClinicWrite', () => {
  it('lets a live trial through', async () => {
    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(true);
  });

  /** The wall the whole trial rests on: writing stops the moment the seventh day is behind them. */
  it('refuses a clinic whose trial has run out', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(false);
  });

  it('refuses a clinic that cancelled', async () => {
    clinics.findById.mockResolvedValue(clinicDoc({ subscriptionStatus: 'cancelled' }));

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(false);
  });

  /** Fails closed. A clinic that cannot be read is not one we can write records for. */
  it('refuses when the clinic cannot be read at all', async () => {
    clinics.findById.mockResolvedValue(null);

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(false);
  });
});

describe('cancelSubscriptionService', () => {
  it('ends a trial inside the seven days', async () => {
    const { status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(200);
    expect(clinics.updateById).toHaveBeenCalledWith(CLINIC_ID, {
      subscriptionStatus: 'cancelled',
      planRenewsAt: null,
      subscriptionEndedAt: expect.any(Date),
    });
  });

  /*
    Without this stamp a self-cancelled clinic has no readable lapse date, `resolveGrace` reads the
    window as already closed, and every patient mid-recovery stops being reminded the moment the
    owner clicks cancel — the exact outcome the grace period exists to prevent.
  */
  it('stamps the lapse so the 14-day reminder window has something to run from', async () => {
    await cancelSubscriptionService(CLINIC_ID);

    const patch = clinics.updateById.mock.calls[0][1] as { subscriptionEndedAt?: Date };
    expect(patch.subscriptionEndedAt).toBeInstanceOf(Date);
  });

  /*
    The response is the refreshed subscription, so the card the button lives on re-renders into its
    cancelled state without a second request. The second `findById` is what the re-read sees.
  */
  it('answers with the cancelled state, not the state it started in', async () => {
    clinics.findById
      .mockResolvedValueOnce(clinicDoc())
      .mockResolvedValueOnce(clinicDoc({ subscriptionStatus: 'cancelled' }));

    const { data } = await cancelSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ status: 'cancelled', canWrite: false, canCancel: false });
  });

  /*
    `trialEndsAt` survives the cancellation. Clearing it would make a clinic that left on day two
    indistinguishable from one that never started a trial.
  */
  it('does not clear the trial end date', async () => {
    await cancelSubscriptionService(CLINIC_ID);

    expect(clinics.updateById.mock.calls[0][1]).not.toHaveProperty('trialEndsAt');
  });

  it('leaves the plan key alone, so what they were on is still readable', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'active' })
    );

    await cancelSubscriptionService(CLINIC_ID);

    expect(clinics.updateById.mock.calls[0][1]).not.toHaveProperty('plan');
  });

  it('cancels at the provider first when there is a paid subscription', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'active', dodoSubscriptionId: 'sub_1' })
    );

    await cancelSubscriptionService(CLINIC_ID);

    expect(dodo.cancelSubscription).toHaveBeenCalledWith('sub_1');
  });

  /*
    The one outcome there is no way to notice from inside the app: marked cancelled here while the
    provider keeps charging. So a provider failure aborts before anything local is written.
  */
  it('writes nothing when the provider refuses the cancellation', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'active', dodoSubscriptionId: 'sub_1' })
    );
    dodo.cancelSubscription.mockResolvedValue({
      ok: false,
      statusCode: 500,
      message: 'provider down',
    } as never);

    const { data, status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(502);
    expect(data).toEqual({ error: 'CANCEL_FAILED' });
    expect(clinics.updateById).not.toHaveBeenCalled();
  });

  it('never calls the provider for a trial, which has no subscription to cancel', async () => {
    await cancelSubscriptionService(CLINIC_ID);

    expect(dodo.cancelSubscription).not.toHaveBeenCalled();
  });

  /** A second submit is a conflict, not a second cancellation. */
  it('refuses to cancel an expired trial', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );

    const { data, status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(409);
    expect(data).toEqual({ error: 'NOT_CANCELLABLE' });
    expect(clinics.updateById).not.toHaveBeenCalled();
  });

  it('refuses to cancel twice', async () => {
    clinics.findById.mockResolvedValue(clinicDoc({ subscriptionStatus: 'cancelled' }));

    const { status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(409);
  });

  it('404s for a clinic that does not exist', async () => {
    clinics.findById.mockResolvedValue(null);

    const { status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(404);
  });
});

/**
 * The 14-day reminder grace window.
 *
 * Writing and sending stop at different moments on purpose. A clinic loses the ability to add
 * patients and build care plans the instant its subscription lapses; the reminders already
 * scheduled keep going for a fortnight, because the patient halfway through a course of
 * antibiotics had no part in the billing. The ceiling is what stops that being a loophole — a
 * six-month rehabilitation plan activated on day six of a free trial must not run for free.
 */
describe('resolveGrace', () => {
  const DAY = 86_400_000;
  const NOW = new Date('2026-08-16T09:00:00.000Z');

  /** A trial that ran out `daysAgo` days ago. The anchor is `trialEndsAt` itself. */
  const expiredTrial = (daysAgo: number) =>
    clinicDoc({ trialEndsAt: new Date(NOW.getTime() - daysAgo * DAY) });

  it('reports no window at all while the subscription is live', () => {
    const grace = resolveGrace(clinicDoc(), NOW);

    expect(grace).toMatchObject({ endsAt: null, daysLeft: null, isActive: false });
    expect(grace.mayDispatch).toBe(true);
  });

  it('keeps sending the day after a trial expires', () => {
    const grace = resolveGrace(expiredTrial(1), NOW);

    expect(grace.mayDispatch).toBe(true);
    expect(grace.isActive).toBe(true);
    expect(grace.daysLeft).toBe(13);
  });

  /* The boundary the whole feature turns on: still sending on day 14, stopped on day 15. */
  it('is still sending on the last day of the window', () => {
    expect(resolveGrace(expiredTrial(13.9), NOW).mayDispatch).toBe(true);
  });

  it('stops sending once the window has closed', () => {
    const grace = resolveGrace(expiredTrial(15), NOW);

    expect(grace.mayDispatch).toBe(false);
    expect(grace.isActive).toBe(false);
    expect(grace.daysLeft).toBe(0);
  });

  it('measures the window from the trial end date, not from today', () => {
    const grace = resolveGrace(expiredTrial(4), NOW);

    expect(grace.endsAt).toEqual(new Date(NOW.getTime() + 10 * DAY));
  });

  it('does not warn before day 10', () => {
    expect(resolveGrace(expiredTrial(9), NOW).isWarning).toBe(false);
  });

  /* Four days of notice, because restoring access can mean a finance approval, not just a click. */
  it('warns from day 10, with four days left', () => {
    const grace = resolveGrace(expiredTrial(10), NOW);

    expect(grace.isWarning).toBe(true);
    expect(grace.daysLeft).toBe(4);
  });

  it('stops warning once the window is over — there is nothing left to warn about', () => {
    expect(resolveGrace(expiredTrial(20), NOW).isWarning).toBe(false);
  });

  it('runs the window from the cancellation date for a clinic that cancelled', () => {
    const clinic = clinicDoc({
      subscriptionStatus: 'cancelled',
      subscriptionEndedAt: new Date(NOW.getTime() - 3 * DAY),
    });

    expect(resolveGrace(clinic, NOW)).toMatchObject({ mayDispatch: true, daysLeft: 11 });
  });

  it('runs the window from the lapse date for a failed renewal', () => {
    const clinic = clinicDoc({
      plan: 'standard',
      subscriptionStatus: 'past_due',
      trialEndsAt: null,
      subscriptionEndedAt: new Date(NOW.getTime() - 16 * DAY),
    });

    expect(resolveGrace(clinic, NOW).mayDispatch).toBe(false);
  });

  /*
    A clinic can hold a stale `subscriptionEndedAt` from an earlier paid period and be trialing
    today. The window has to be measured from the lapse that is actually in force, or a clinic
    that lapsed last year would start its new trial already out of grace.
  */
  it('prefers the trial end date over a stale lapse stamp', () => {
    const clinic = clinicDoc({
      trialEndsAt: new Date(NOW.getTime() - DAY),
      subscriptionEndedAt: new Date(NOW.getTime() - 400 * DAY),
    });

    expect(resolveGrace(clinic, NOW)).toMatchObject({ mayDispatch: true, daysLeft: 13 });
  });

  /*
    An unbounded grace period is the loophole the ceiling exists to close, so a lapsed clinic with
    no anchor reads as a window that has already shut. Only clinics that lapsed before the field
    existed are in this state, and they lapsed months ago.
  */
  it('treats a lapse with no recorded date as a window already closed', () => {
    const clinic = clinicDoc({
      subscriptionStatus: 'cancelled',
      trialEndsAt: null,
      subscriptionEndedAt: null,
    });

    expect(resolveGrace(clinic, NOW).mayDispatch).toBe(false);
  });
});

describe('canClinicDispatch', () => {
  const DAY = 86_400_000;

  /* The two gates answer different questions, and the difference is the point of the design. */
  it('still sends for a clinic that may no longer write', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 2 * DAY) })
    );

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(false);
    await expect(canClinicDispatch(CLINIC_ID)).resolves.toBe(true);
  });

  it('stops sending past the fourteenth day', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 15 * DAY) })
    );

    await expect(canClinicDispatch(CLINIC_ID)).resolves.toBe(false);
  });

  /** Fails closed: a reminder we cannot attribute to a live practice is one we do not send. */
  it('refuses when the clinic cannot be read at all', async () => {
    clinics.findById.mockResolvedValue(null);

    await expect(canClinicDispatch(CLINIC_ID)).resolves.toBe(false);
  });
});

/**
 * Cancelling a paid plan takes effect at the end of the period already charged for.
 *
 * Cancelling on the 2nd used to delete the twenty-eight days the clinic had just paid for, which
 * is both wrong and the kind of thing that comes back as a card dispute. A trial has nothing paid
 * for and still ends on the spot.
 */
describe('cancelSubscriptionService — period-end cancellation', () => {
  const DAY = 86_400_000;

  it('keeps the paid period rather than clearing it', async () => {
    const renewsAt = new Date(Date.now() + 20 * DAY);
    clinics.findById.mockResolvedValue(clinicDoc({
      plan: 'standard',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      planRenewsAt: renewsAt,
    }));

    await cancelSubscriptionService(CLINIC_ID);

    const patch = clinics.updateById.mock.calls[0][1] as { planRenewsAt?: Date | null };
    expect(patch.planRenewsAt).toEqual(renewsAt);
  });

  /*
    Anchoring the reminder grace to the click would run the fourteen days down while the clinic was
    still a paying customer — a clinic cancelling on day two of an annual plan would find its
    patients unreachable eleven and a half months early.
  */
  it('anchors the reminder grace to the end of the paid period, not to the click', async () => {
    const renewsAt = new Date(Date.now() + 20 * DAY);
    clinics.findById.mockResolvedValue(clinicDoc({
      plan: 'standard',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      planRenewsAt: renewsAt,
    }));

    await cancelSubscriptionService(CLINIC_ID);

    const patch = clinics.updateById.mock.calls[0][1] as { subscriptionEndedAt?: Date };
    expect(patch.subscriptionEndedAt).toEqual(renewsAt);
  });

  it('still ends a trial immediately — nothing has been paid for', async () => {
    await cancelSubscriptionService(CLINIC_ID);

    const patch = clinics.updateById.mock.calls[0][1] as {
      planRenewsAt?: Date | null;
      subscriptionEndedAt?: Date;
    };
    expect(patch.planRenewsAt).toBeNull();
    expect(patch.subscriptionEndedAt).toBeInstanceOf(Date);
  });

  it('refuses a second cancellation while the first is still pending', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({
        plan: 'standard',
        subscriptionStatus: 'cancelled',
        trialEndsAt: null,
        planRenewsAt: new Date(Date.now() + 10 * DAY),
      })
    );

    const { data, status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(409);
    expect(data).toEqual({ error: 'ALREADY_CANCELLED' });
    expect(clinics.updateById).not.toHaveBeenCalled();
  });
});

describe('a cancellation that has not taken effect yet', () => {
  const DAY = 86_400_000;

  /** Cancelled, ten days of paid access left. Either our endpoint or Dodo's portal gets here. */
  const pending = () =>
    clinicDoc({
      plan: 'standard',
      subscriptionStatus: 'cancelled',
      trialEndsAt: null,
      planRenewsAt: new Date(Date.now() + 10 * DAY),
      subscriptionEndedAt: new Date(Date.now() + 10 * DAY),
    });

  it('still reads as active', () => {
    expect(resolveStatus(pending(), new Date())).toBe('active');
  });

  it('can still add patients', async () => {
    clinics.findById.mockResolvedValue(pending());

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(true);
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });

  it('is not in a grace window, because nothing has lapsed yet', () => {
    const grace = resolveGrace(pending(), new Date());

    expect(grace).toMatchObject({ isActive: false, endsAt: null });
    expect(grace.mayDispatch).toBe(true);
  });

  /* The owner needs to see the cancellation landed, and when it bites. */
  it('is reported to the dashboard, with the Cancel button withdrawn', async () => {
    clinics.findById.mockResolvedValue(pending());

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ status: 'active', cancelScheduled: true, canCancel: false });
  });

  it('takes effect once the paid period runs out', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({
        plan: 'standard',
        subscriptionStatus: 'cancelled',
        trialEndsAt: null,
        planRenewsAt: new Date(Date.now() - DAY),
        subscriptionEndedAt: new Date(Date.now() - DAY),
      })
    );

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ status: 'cancelled', canWrite: false, cancelScheduled: false });
  });

  /*
    A cancellation made inside Dodo's portal stamps `subscriptionEndedAt` when the webhook lands,
    which can be weeks before the period ends. The grace window has to run from the later of the
    two or the clinic loses reminder days it paid for.
  */
  it('runs the grace from the period end even when the webhook stamped it earlier', () => {
    const periodEnded = new Date(Date.now() - 2 * DAY);
    const clinic = clinicDoc({
      plan: 'standard',
      subscriptionStatus: 'cancelled',
      trialEndsAt: null,
      planRenewsAt: periodEnded,
      subscriptionEndedAt: new Date(Date.now() - 30 * DAY),
    });

    // Measured from two days ago, not thirty — so twelve of the fourteen days are left.
    expect(resolveGrace(clinic, new Date())).toMatchObject({ mayDispatch: true, daysLeft: 12 });
  });
});

/**
 * Premium's promises, asserted on the plan the clinic is actually on.
 *
 * The rules themselves are plan-agnostic and covered above; these exist because "unlimited" is a
 * claim printed on a pricing page and sold, so the code backing it should fail loudly rather than
 * quietly acquire a cap.
 */
describe('Premium — unlimited capacity', () => {
  const DAY = 86_400_000;

  const premium = (overrides = {}) =>
    clinicDoc({ plan: 'premium', subscriptionStatus: 'active', trialEndsAt: null, ...overrides });

  it('reports no patient limit at all, rather than a very large one', async () => {
    clinics.findById.mockResolvedValue(premium());
    patients.findAllByClinic.mockResolvedValue(roster(4000));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ patientLimit: null, isAtPatientLimit: false });
  });

  it('admits another patient at four thousand', async () => {
    clinics.findById.mockResolvedValue(premium());
    patients.findAllByClinic.mockResolvedValue(roster(4000));

    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });

  /* Cancellation is plan-agnostic, but Premium is the annual plan where cutting early costs most. */
  it('cancels at the end of the paid period like every other paid plan', async () => {
    const renewsAt = new Date(Date.now() + 300 * DAY);
    clinics.findById.mockResolvedValue(premium({ planRenewsAt: renewsAt }));

    const { status } = await cancelSubscriptionService(CLINIC_ID);

    expect(status).toBe(200);
    const patch = clinics.updateById.mock.calls[0][1] as {
      planRenewsAt?: Date | null;
      subscriptionEndedAt?: Date;
    };
    expect(patch.planRenewsAt).toEqual(renewsAt);
    expect(patch.subscriptionEndedAt).toEqual(renewsAt);
  });

  it('keeps full access for the rest of a cancelled annual period', async () => {
    clinics.findById.mockResolvedValue(
      premium({
        subscriptionStatus: 'cancelled',
        planRenewsAt: new Date(Date.now() + 300 * DAY),
        subscriptionEndedAt: new Date(Date.now() + 300 * DAY),
      })
    );

    await expect(canClinicWrite(CLINIC_ID)).resolves.toBe(true);
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });
});
