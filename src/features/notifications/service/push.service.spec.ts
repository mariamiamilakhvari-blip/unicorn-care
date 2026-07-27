import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: {
    upsertByEndpoint: vi.fn(),
    findActiveByPatient: vi.fn(),
    deactivateByEndpoint: vi.fn(),
    incrementFailure: vi.fn(),
    markSuccess: vi.fn(),
  },
}));

vi.mock('@/shared/lib/web-push-client', () => ({ webPushClient: { send: vi.fn() } }));

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { PushSubscriptionDocument } from '@/features/notifications/schema/push-subscription.schema';
import { PushPayload, webPushClient } from '@/shared/lib/web-push-client';

import {
  sendToPatientService,
  subscribeService,
  unsubscribeService,
} from './push.service';

const subscriptionRepo = vi.mocked(pushSubscriptionRepository);
const pushClient = vi.mocked(webPushClient);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const OTHER_PATIENT_ID = '507f1f77bcf86cd799439099';
const NOW = new Date('2026-07-27T08:05:00.000Z');

const PAYLOAD: PushPayload = {
  title: 'Amoxicillin — 500 mg',
  body: 'Take with food. 08:00',
  url: '/p',
  occurrenceId: '507f1f77bcf86cd799439055',
  tag: '507f1f77bcf86cd799439055',
};

const buildSubscription = (endpoint: string): PushSubscriptionDocument => ({
  _id: new mongoose.Types.ObjectId(),
  patientId: new mongoose.Types.ObjectId(PATIENT_ID),
  endpoint,
  p256dh: 'p256dh-key',
  authKey: 'auth-key',
  userAgent: 'Mozilla/5.0 (Android)',
  locale: 'ka',
  isActive: true,
  failureCount: 0,
  lastSuccessAt: null,
  createdAt: NOW,
  updatedAt: NOW,
});

describe('push.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    subscriptionRepo.upsertByEndpoint.mockResolvedValue(true);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    subscriptionRepo.deactivateByEndpoint.mockResolvedValue(true);
    subscriptionRepo.incrementFailure.mockResolvedValue(true);
    subscriptionRepo.markSuccess.mockResolvedValue(true);
  });

  it('upserts by endpoint with the guard locale and the request user agent', async () => {
    const result = await subscribeService(
      PATIENT_ID,
      'en',
      { endpoint: 'https://fcm/a', keys: { p256dh: 'p', auth: 'a' } },
      'Mozilla/5.0 (iPhone)'
    );

    expect(subscriptionRepo.upsertByEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://fcm/a',
        p256dh: 'p',
        authKey: 'a',
        userAgent: 'Mozilla/5.0 (iPhone)',
        locale: 'en',
        isActive: true,
        failureCount: 0,
      })
    );
    expect(result.status).toBe(201);
  });

  it('refuses to retire an endpoint the patient does not own', async () => {
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/mine')]);

    const result = await unsubscribeService(OTHER_PATIENT_ID, 'https://fcm/someone-else');

    expect(subscriptionRepo.deactivateByEndpoint).not.toHaveBeenCalled();
    expect(result).toEqual({ data: { error: 'NOT_FOUND' }, status: 404 });
  });

  it('deactivates an owned endpoint rather than deleting it', async () => {
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/mine')]);

    const result = await unsubscribeService(PATIENT_ID, 'https://fcm/mine');

    expect(subscriptionRepo.deactivateByEndpoint).toHaveBeenCalledWith('https://fcm/mine');
    expect(result.status).toBe(200);
  });

  it('returns an empty summary and sends nothing when the patient has no active endpoint', async () => {
    const result = await sendToPatientService(PATIENT_ID, PAYLOAD);

    expect(pushClient.send).not.toHaveBeenCalled();
    expect(result.data).toEqual({ total: 0, sent: 0, deactivated: 0 });
  });

  it('marks success on a delivered endpoint', async () => {
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    const result = await sendToPatientService(PATIENT_ID, PAYLOAD);

    expect(subscriptionRepo.markSuccess).toHaveBeenCalledWith('https://fcm/a', NOW);
    expect(result.data).toEqual({ total: 1, sent: 1, deactivated: 0 });
  });

  it('deactivates on 410 and only counts failures on a transient error', async () => {
    subscriptionRepo.findActiveByPatient.mockResolvedValue([
      buildSubscription('https://fcm/gone'),
      buildSubscription('https://fcm/flaky'),
    ]);
    pushClient.send
      .mockResolvedValueOnce({ ok: false, statusCode: 410, gone: true })
      .mockResolvedValueOnce({ ok: false, statusCode: 500, gone: false });

    const result = await sendToPatientService(PATIENT_ID, PAYLOAD);

    expect(subscriptionRepo.deactivateByEndpoint).toHaveBeenCalledWith('https://fcm/gone');
    expect(subscriptionRepo.incrementFailure).toHaveBeenCalledWith('https://fcm/flaky');
    expect(result.data).toEqual({ total: 2, sent: 0, deactivated: 1 });
  });
});
