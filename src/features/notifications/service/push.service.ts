import mongoose from 'mongoose';

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { PushSubscriptionDocument } from '@/features/notifications/schema/push-subscription.schema';
import { PushSendSummary } from '@/features/notifications/types/push.types';
import { PushSubscribeType } from '@/features/notifications/validations/push.validation';
import { clock } from '@/shared/lib/clock';
import { PushPayload, webPushClient } from '@/shared/lib/web-push-client';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

type DeliveryOutcome = 'sent' | 'gone' | 'failed';

const EMPTY_SUMMARY: PushSendSummary = { total: 0, sent: 0, deactivated: 0 };

/**
 * Send one payload to one subscription and record the outcome on the row.
 *
 * `webPushClient.send` never throws (PRD 04), so a dead endpoint inside a 500-item sweep can
 * never abort the batch.
 */
async function deliver(
  subscription: PushSubscriptionDocument,
  payload: PushPayload
): Promise<DeliveryOutcome> {
  const result = await webPushClient.send(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.authKey,
    },
    payload
  );

  if (result.ok) {
    await pushSubscriptionRepository.markSuccess(subscription.endpoint, clock.now());
    return 'sent';
  }

  // 404/410 — the browser dropped the subscription. It will never work again (PRD 01 §8).
  if (result.gone) {
    await pushSubscriptionRepository.deactivateByEndpoint(subscription.endpoint);
    return 'gone';
  }

  await pushSubscriptionRepository.incrementFailure(subscription.endpoint);
  return 'failed';
}

/** Upsert by endpoint so a re-subscribe from the same browser replaces rather than duplicates. */
export async function subscribeService(
  patientId: string,
  locale: AppLocale,
  input: PushSubscribeType,
  userAgent: string
): Promise<ServiceResult<{ message: string }>> {
  await pushSubscriptionRepository.upsertByEndpoint({
    // `mongoose.Types.ObjectId` is the id value type, not a model — CLAUDE.md §8 keeps *models*
    // out of the service layer, and the repository input type is expressed in ObjectIds.
    patientId: new mongoose.Types.ObjectId(patientId),
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    authKey: input.keys.auth,
    userAgent,
    locale,
    isActive: true,
    failureCount: 0,
    lastSuccessAt: null,
  });

  return { data: { message: 'SUBSCRIBED' }, status: 201 };
}

/**
 * Deactivate rather than delete — the row is the audit trail for why a patient stopped
 * receiving reminders. `patientId` is checked against the row so one patient's token can never
 * retire another patient's endpoint.
 */
export async function unsubscribeService(
  patientId: string,
  endpoint: string
): Promise<ServiceResult<{ message: string }>> {
  const active = await pushSubscriptionRepository.findActiveByPatient(patientId);
  const owned = active.some(subscription => subscription.endpoint === endpoint);
  if (!owned) return { data: { error: 'NOT_FOUND' }, status: 404 };

  await pushSubscriptionRepository.deactivateByEndpoint(endpoint);
  return { data: { message: 'UNSUBSCRIBED' }, status: 200 };
}

/**
 * Fan a payload out to every active subscription a patient has (phone + tablet + desktop).
 * Sequential on purpose: a patient has a handful of endpoints, and serialising keeps the sweep
 * from opening 500 concurrent TLS connections to the push services.
 */
export async function sendToPatientService(
  patientId: string,
  payload: PushPayload
): Promise<ServiceResult<PushSendSummary>> {
  const subscriptions = await pushSubscriptionRepository.findActiveByPatient(patientId);
  if (subscriptions.length === 0) return { data: EMPTY_SUMMARY, status: 200 };

  let sent = 0;
  let deactivated = 0;

  for (const subscription of subscriptions) {
    const outcome = await deliver(subscription, payload);
    if (outcome === 'sent') sent += 1;
    if (outcome === 'gone') deactivated += 1;
  }

  return { data: { total: subscriptions.length, sent, deactivated }, status: 200 };
}
