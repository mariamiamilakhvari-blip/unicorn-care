import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { BillingPeriod, PaidPlanKey, resolveProductId } from '@/shared/const/billing.const';
import { PlanKey } from '@/shared/const/plan.const';
import { SubscriptionStatus } from '@/shared/const/subscription.const';
import { clock } from '@/shared/lib/clock';
import { dodoClient } from '@/shared/lib/dodo-client';
import { ServiceResult } from '@/shared/types/common';

export type CheckoutStart = { checkoutUrl: string };

/**
 * Starts a hosted checkout for a paid plan.
 *
 * The clinic id goes into `metadata` because that is the only thing tying the eventual webhook
 * back to a row in our database — Dodo knows nothing about clinics.
 */
export async function startCheckoutService(
  clinicId: string,
  userId: string,
  plan: PaidPlanKey,
  period: BillingPeriod,
  appUrl: string
): Promise<ServiceResult<CheckoutStart>> {
  const productId = resolveProductId(plan, period);
  if (!productId) return { data: { error: 'PRODUCT_NOT_CONFIGURED' }, status: 500 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const owner = await userRepository.findById(userId);
  if (!owner) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const result = await dodoClient.createCheckoutSession({
    lines: [{ productId, quantity: 1 }],
    returnUrl: `${appUrl}/dashboard/clinic?billing=success`,
    cancelUrl: `${appUrl}/dashboard/clinic?billing=cancelled`,
    customerEmail: owner.email,
    customerName: clinic.name,
    metadata: { clinicId, plan, period },
  });

  if (!result.ok) {
    console.error('[billing] checkout failed', result.statusCode, result.message);
    return { data: { error: 'CHECKOUT_FAILED' }, status: 502 };
  }

  return { data: { checkoutUrl: result.checkoutUrl }, status: 200 };
}

/** Dodo event names → the subscription status we store. */
const EVENT_STATUS: Record<string, SubscriptionStatus> = {
  'subscription.active': 'active',
  'subscription.renewed': 'active',
  'subscription.plan_changed': 'active',
  'subscription.on_hold': 'past_due',
  'subscription.failed': 'past_due',
  'subscription.cancelled': 'cancelled',
  'subscription.expired': 'expired',
};

export type DodoWebhookEvent = {
  type?: string;
  data?: {
    subscription_id?: string;
    customer?: { customer_id?: string };
    metadata?: Record<string, string>;
    next_billing_date?: string;
  };
};

/**
 * Applies a verified webhook to the clinic's subscription.
 *
 * This is the *only* path that grants a paid plan. Nothing the browser sends can upgrade a
 * clinic — otherwise a clinic could grant itself Premium by calling our own API.
 *
 * Unknown event types are acknowledged rather than rejected: returning an error would make Dodo
 * retry an event we will never act on.
 */
export async function applySubscriptionEventService(
  event: DodoWebhookEvent
): Promise<ServiceResult<{ applied: boolean }>> {
  const type = event.type ?? '';
  const status = EVENT_STATUS[type];
  if (!status) return { data: { applied: false }, status: 200 };

  const clinicId = event.data?.metadata?.clinicId;
  const plan = event.data?.metadata?.plan as PlanKey | undefined;
  if (!clinicId || !plan) {
    console.error('[billing] webhook without clinic metadata', type);
    return { data: { error: 'MISSING_METADATA' }, status: 400 };
  }

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  /*
    A lapsed clinic keeps the plan it bought and only changes status, so the record of what they
    were paying for survives a failed renewal and restoring access is a status change.
  */
  const keepsPlan = status === 'past_due' || status === 'cancelled' || status === 'expired';

  /*
    A clinic can hold more than one subscription — a duplicate checkout, or an upgrade bought before
    the old one was cancelled. Applying every ending event blindly meant cancelling the *duplicate*
    revoked access while the clinic's real subscription was still active and still being charged:
    they kept paying and were locked out of adding patients.

    So an ending event only counts when it comes from the subscription the clinic is actually on.
    Activations are never filtered — they are how a clinic moves to a new subscription, and the
    write below records that new id as the current one.
  */
  const eventSubscriptionId = event.data?.subscription_id ?? null;
  const endsSubscription = keepsPlan;
  const isStaleSubscription =
    endsSubscription &&
    Boolean(clinic.dodoSubscriptionId) &&
    Boolean(eventSubscriptionId) &&
    eventSubscriptionId !== clinic.dodoSubscriptionId;

  if (isStaleSubscription) {
    console.warn('[billing] ignoring end event for a subscription the clinic has moved off', {
      clinicId,
      event: eventSubscriptionId,
      current: clinic.dodoSubscriptionId,
    });
    return { data: { applied: false }, status: 200 };
  }

  await clinicRepository.updateById(clinicId, {
    plan: keepsPlan ? clinic.plan : plan,
    subscriptionStatus: status,
    dodoSubscriptionId: event.data?.subscription_id ?? clinic.dodoSubscriptionId ?? null,
    dodoCustomerId: event.data?.customer?.customer_id ?? clinic.dodoCustomerId ?? null,
    planRenewsAt: event.data?.next_billing_date
      ? new Date(event.data.next_billing_date)
      : clinic.planRenewsAt ?? null,
    // The trial is over once a real subscription exists either way.
    trialEndsAt: status === 'active' ? null : clinic.trialEndsAt ?? null,
  });

  return { data: { applied: true }, status: 200 };
}

/** Kept for local development only — see the guard in the route. */
export async function grantTrialService(clinicId: string): Promise<void> {
  await clinicRepository.updateById(clinicId, {
    plan: 'trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: clock.addDays(clock.now(), 7),
    planRenewsAt: null,
  });
}
