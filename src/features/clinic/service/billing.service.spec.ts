 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: { findById: vi.fn() },
}));

vi.mock('@/shared/lib/dodo-client', () => ({
  dodoClient: { createCheckoutSession: vi.fn(), isLiveMode: vi.fn(() => false) },
}));

import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import {
  applySubscriptionEventService,
  startCheckoutService,
} from '@/features/clinic/service/billing.service';
import { dodoClient } from '@/shared/lib/dodo-client';

const CLINIC_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';

const clinics = vi.mocked(clinicRepository);
const users = vi.mocked(userRepository);
const dodo = vi.mocked(dodoClient);

function clinicDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CLINIC_ID,
    name: 'Gold Esthetic',
    plan: 'trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(),
    planRenewsAt: null,
    dodoCustomerId: null,
    dodoSubscriptionId: null,
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DODO_PRODUCT_STANDARD_YEARLY = 'pdt_standard_yearly';
  process.env.DODO_PRODUCT_PREMIUM_MONTHLY = 'pdt_premium_monthly';
  clinics.findById.mockResolvedValue(clinicDoc());
  clinics.updateById.mockResolvedValue(true);
  users.findById.mockResolvedValue({ email: 'owner@clinic.ge', name: 'Owner' } as never);
  dodo.createCheckoutSession.mockResolvedValue({
    ok: true,
    checkoutUrl: 'https://checkout.example/x',
    sessionId: 'cks_1',
  });
});

describe('startCheckoutService', () => {
  it('sends the clinic id in metadata so the webhook can be traced back', async () => {
    await startCheckoutService(CLINIC_ID, USER_ID, 'standard', 'yearly', 'https://app.example');

    const input = dodo.createCheckoutSession.mock.calls[0][0];
    expect(input.metadata).toEqual({ clinicId: CLINIC_ID, plan: 'standard', period: 'yearly' });
    expect(input.lines).toEqual([{ productId: 'pdt_standard_yearly', quantity: 1 }]);
  });

  it('refuses when the product is not configured rather than charging the wrong one', async () => {
    delete process.env.DODO_PRODUCT_PREMIUM_MONTHLY;

    const { status, data } = await startCheckoutService(
      CLINIC_ID,
      USER_ID,
      'premium',
      'monthly',
      'https://app.example'
    );

    expect(status).toBe(500);
    expect(data).toMatchObject({ error: 'PRODUCT_NOT_CONFIGURED' });
    expect(dodo.createCheckoutSession).not.toHaveBeenCalled();
  });

  /** Starting checkout must never grant anything — only the webhook does. */
  it('does not change the plan', async () => {
    await startCheckoutService(CLINIC_ID, USER_ID, 'premium', 'monthly', 'https://app.example');
    expect(clinics.updateById).not.toHaveBeenCalled();
  });

  it('reports a provider failure as 502', async () => {
    dodo.createCheckoutSession.mockResolvedValue({
      ok: false,
      statusCode: 500,
      message: 'boom',
    });

    const { status } = await startCheckoutService(
      CLINIC_ID,
      USER_ID,
      'standard',
      'yearly',
      'https://app.example'
    );
    expect(status).toBe(502);
  });
});

describe('applySubscriptionEventService', () => {
  function event(type: string, data: Record<string, unknown> = {}) {
    return {
      type,
      data: {
        subscription_id: 'sub_1',
        customer: { customer_id: 'cus_1' },
        metadata: { clinicId: CLINIC_ID, plan: 'standard' },
        ...data,
      },
    };
  }

  it('activates the purchased plan and stores the provider ids', async () => {
    await applySubscriptionEventService(event('subscription.active'));

    expect(clinics.updateById).toHaveBeenCalledWith(
      CLINIC_ID,
      expect.objectContaining({
        plan: 'standard',
        subscriptionStatus: 'active',
        dodoSubscriptionId: 'sub_1',
        dodoCustomerId: 'cus_1',
      })
    );
  });

  it('clears the trial once a real subscription is active', async () => {
    await applySubscriptionEventService(event('subscription.active'));
    expect(clinics.updateById.mock.calls[0][1]).toMatchObject({ trialEndsAt: null });
  });

  it('treats a renewal as active', async () => {
    await applySubscriptionEventService(event('subscription.renewed'));
    expect(clinics.updateById.mock.calls[0][1]).toMatchObject({ subscriptionStatus: 'active' });
  });

  /**
   * A failed renewal must not erase what the clinic was paying for — restoring access should be a
   * status change, not a re-purchase.
   */
  it('keeps the existing plan when a subscription lapses', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'premium', subscriptionStatus: 'active' })
    );

    await applySubscriptionEventService(event('subscription.failed'));

    expect(clinics.updateById.mock.calls[0][1]).toMatchObject({
      plan: 'premium',
      subscriptionStatus: 'past_due',
    });
  });

  it('maps cancellation and expiry without downgrading the recorded plan', async () => {
    clinics.findById.mockResolvedValue(clinicDoc({ plan: 'premium' }));

    await applySubscriptionEventService(event('subscription.cancelled'));
    expect(clinics.updateById.mock.calls[0][1]).toMatchObject({
      plan: 'premium',
      subscriptionStatus: 'cancelled',
    });

    vi.clearAllMocks();
    clinics.findById.mockResolvedValue(clinicDoc({ plan: 'premium' }));
    await applySubscriptionEventService(event('subscription.expired'));
    expect(clinics.updateById.mock.calls[0][1]).toMatchObject({ subscriptionStatus: 'expired' });
  });

  /** Rejecting these would make Dodo retry an event we will never act on. */
  it('acknowledges an event type it does not handle without writing', async () => {
    const { status, data } = await applySubscriptionEventService(event('payment.succeeded'));

    expect(status).toBe(200);
    expect(data).toMatchObject({ applied: false });
    expect(clinics.updateById).not.toHaveBeenCalled();
  });

  it('refuses an event with no clinic metadata instead of guessing', async () => {
    const { status } = await applySubscriptionEventService({
      type: 'subscription.active',
      data: { subscription_id: 'sub_1', metadata: {} },
    });

    expect(status).toBe(400);
    expect(clinics.updateById).not.toHaveBeenCalled();
  });
});
