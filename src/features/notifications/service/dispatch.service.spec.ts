import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    findDueForDispatch: vi.fn(),
    updateStatus: vi.fn(),
    markMissedBefore: vi.fn(),
  },
}));

vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: {
    findActiveByPatient: vi.fn(),
    deactivateByEndpoint: vi.fn(),
    incrementFailure: vi.fn(),
    markSuccess: vi.fn(),
  },
}));

vi.mock('@/shared/lib/web-push-client', () => ({ webPushClient: { send: vi.fn() } }));

vi.mock('@/features/care-plan/service/dispatch-extension.service', () => ({
  extendActivePlansService: vi.fn(),
}));

import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { PushSubscriptionDocument } from '@/features/notifications/schema/push-subscription.schema';
import { webPushClient } from '@/shared/lib/web-push-client';

import { dispatchDueRemindersService } from './dispatch.service';

const occurrenceRepo = vi.mocked(reminderOccurrenceRepository);
const subscriptionRepo = vi.mocked(pushSubscriptionRepository);
const pushClient = vi.mocked(webPushClient);
const extendPlans = vi.mocked(extendActivePlansService);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
const PLAN_ID = '507f1f77bcf86cd799439033';
const ITEM_ID = '507f1f77bcf86cd799439044';
const OCCURRENCE_ID = '507f1f77bcf86cd799439055';

const NOW = new Date('2026-07-27T08:05:00.000Z');
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const buildOccurrence = (id = OCCURRENCE_ID): ReminderOccurrenceDocument => ({
  _id: new mongoose.Types.ObjectId(id),
  carePlanId: new mongoose.Types.ObjectId(PLAN_ID),
  patientId: new mongoose.Types.ObjectId(PATIENT_ID),
  clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
  kind: 'medication',
  sourceItemId: new mongoose.Types.ObjectId(ITEM_ID),
  title: 'Amoxicillin — 500 mg',
  body: 'Take with food. 08:00',
  intensity: null,
  dueAt: new Date('2026-07-27T08:00:00.000Z'),
  status: 'pending',
  sentAt: null,
  completedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
});

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

describe('dispatchDueRemindersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    occurrenceRepo.findDueForDispatch.mockResolvedValue([]);
    occurrenceRepo.updateStatus.mockResolvedValue(true);
    occurrenceRepo.markMissedBefore.mockResolvedValue(0);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    subscriptionRepo.deactivateByEndpoint.mockResolvedValue(true);
    subscriptionRepo.incrementFailure.mockResolvedValue(true);
    subscriptionRepo.markSuccess.mockResolvedValue(true);
    extendPlans.mockResolvedValue(0);
  });

  it('queries the 6h window with the 500 cap and marks a delivered occurrence sent', async () => {
    occurrenceRepo.findDueForDispatch.mockResolvedValue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.findDueForDispatch).toHaveBeenCalledWith(NOW, 6, 500);
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
    });
    expect(result.data).toMatchObject({ processed: 1, sent: 1, undelivered: 0 });
  });

  it('tags the payload with the occurrence id so a resend replaces rather than stacks', async () => {
    occurrenceRepo.findDueForDispatch.mockResolvedValue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    await dispatchDueRemindersService();

    expect(pushClient.send).toHaveBeenCalledWith(
      { endpoint: 'https://fcm/a', p256dh: 'p256dh-key', auth: 'auth-key' },
      expect.objectContaining({ occurrenceId: OCCURRENCE_ID, tag: OCCURRENCE_ID, url: '/p' })
    );
  });

  it('deactivates the endpoint on a 410 and still retires the occurrence', async () => {
    occurrenceRepo.findDueForDispatch.mockResolvedValue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/dead')]);
    pushClient.send.mockResolvedValue({ ok: false, statusCode: 410, gone: true });

    const result = await dispatchDueRemindersService();

    expect(subscriptionRepo.deactivateByEndpoint).toHaveBeenCalledWith('https://fcm/dead');
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
    });
    expect(result.data).toMatchObject({ processed: 1, sent: 0, undelivered: 1 });
  });

  it('counts the occurrence as sent when one endpoint is gone but another accepts', async () => {
    occurrenceRepo.findDueForDispatch.mockResolvedValue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([
      buildSubscription('https://fcm/dead'),
      buildSubscription('https://fcm/live'),
    ]);
    pushClient.send
      .mockResolvedValueOnce({ ok: false, statusCode: 404, gone: true })
      .mockResolvedValueOnce({ ok: true });

    const result = await dispatchDueRemindersService();

    expect(subscriptionRepo.deactivateByEndpoint).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ sent: 1, undelivered: 0 });
  });

  it('retires an occurrence with no active subscription so the sweep cannot loop forever', async () => {
    occurrenceRepo.findDueForDispatch.mockResolvedValue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);

    const result = await dispatchDueRemindersService();

    expect(pushClient.send).not.toHaveBeenCalled();
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
    });
    expect(result.data).toMatchObject({ processed: 1, sent: 0, undelivered: 1 });
  });

  it('flips anything still pending past the 6h grace window to missed', async () => {
    occurrenceRepo.markMissedBefore.mockResolvedValue(4);

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.markMissedBefore).toHaveBeenCalledWith(
      new Date(NOW.getTime() - SIX_HOURS_MS)
    );
    expect(result.data).toMatchObject({ missed: 4 });
  });

  it('rolls the generation horizon forward at the end of the sweep', async () => {
    extendPlans.mockResolvedValue(3);

    const result = await dispatchDueRemindersService();

    expect(extendPlans).toHaveBeenCalledWith(NOW);
    expect(result).toMatchObject({ status: 200 });
    expect(result.data).toMatchObject({ extendedPlans: 3 });
  });
});
