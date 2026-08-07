import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    findDueForDispatch: vi.fn(),
    claimForDispatch: vi.fn(),
    findByClaimId: vi.fn(),
    releaseStaleClaims: vi.fn(),
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

vi.mock('@/features/notifications/service/email-dispatch.service', () => ({
  sendDailyDigestsService: vi.fn(),
  createReminderEmailSender: vi.fn(),
}));

import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { PushSubscriptionDocument } from '@/features/notifications/schema/push-subscription.schema';
import {
  createReminderEmailSender,
  sendDailyDigestsService,
} from '@/features/notifications/service/email-dispatch.service';
import { webPushClient } from '@/shared/lib/web-push-client';

import { dispatchDueRemindersService } from './dispatch.service';

const occurrenceRepo = vi.mocked(reminderOccurrenceRepository);
const subscriptionRepo = vi.mocked(pushSubscriptionRepository);
const pushClient = vi.mocked(webPushClient);
const extendPlans = vi.mocked(extendActivePlansService);
const sendDigests = vi.mocked(sendDailyDigestsService);
const makeReminderSender = vi.mocked(createReminderEmailSender);

/** The per-occurrence email sender the sweep builds once per run. */
let sendReminderEmail: ReturnType<typeof createReminderEmailSender>;

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

/**
 * Stages rows for one run. Selection and sending are now separate steps, so a test has to supply
 * both what the sweep finds and what it successfully claims — by default it wins every row.
 */
const givenDue = (occurrences: ReminderOccurrenceDocument[], claimed = occurrences) => {
  occurrenceRepo.findDueForDispatch.mockResolvedValue(occurrences);
  occurrenceRepo.claimForDispatch.mockResolvedValue(claimed.length);
  occurrenceRepo.findByClaimId.mockResolvedValue(claimed);
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

describe('dispatchDueRemindersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    givenDue([]);
    occurrenceRepo.releaseStaleClaims.mockResolvedValue(0);
    occurrenceRepo.updateStatus.mockResolvedValue(true);
    occurrenceRepo.markMissedBefore.mockResolvedValue(0);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    subscriptionRepo.deactivateByEndpoint.mockResolvedValue(true);
    subscriptionRepo.incrementFailure.mockResolvedValue(true);
    subscriptionRepo.markSuccess.mockResolvedValue(true);
    extendPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({ data: { considered: 0, sent: 0, failed: 0, skipped: 0 }, status: 200 });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
  });

  it('queries the 6h window with the 500 cap and marks a delivered occurrence sent', async () => {
    givenDue([buildOccurrence()]);
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
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    await dispatchDueRemindersService();

    expect(pushClient.send).toHaveBeenCalledWith(
      { endpoint: 'https://fcm/a', p256dh: 'p256dh-key', auth: 'auth-key' },
      expect.objectContaining({ occurrenceId: OCCURRENCE_ID, tag: OCCURRENCE_ID, url: '/p' })
    );
  });

  it('deactivates the endpoint on a 410 and still retires the occurrence', async () => {
    givenDue([buildOccurrence()]);
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
    givenDue([buildOccurrence()]);
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
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);

    const result = await dispatchDueRemindersService();

    expect(pushClient.send).not.toHaveBeenCalled();
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
    });
    expect(result.data).toMatchObject({ processed: 1, sent: 0, undelivered: 1 });
  });

  it('claims a row before sending it, so a competing run cannot pick up the same one', async () => {
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    await dispatchDueRemindersService();

    // The compare-and-set that makes the claim exclusive lives in the repository filter; what the
    // service must guarantee is that nothing is pushed before the claim lands.
    const claimOrder = occurrenceRepo.claimForDispatch.mock.invocationCallOrder[0];
    const sendOrder = pushClient.send.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(sendOrder);
    expect(occurrenceRepo.claimForDispatch).toHaveBeenCalledWith(
      [OCCURRENCE_ID],
      expect.any(String),
      NOW
    );
  });

  it('sends only rows it won, so the loser of a race pushes nothing', async () => {
    // Both runs select the row; the other run claims it first, so this run's claim matches nothing.
    givenDue([buildOccurrence()], []);

    const result = await dispatchDueRemindersService();

    expect(pushClient.send).not.toHaveBeenCalled();
    expect(occurrenceRepo.updateStatus).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ processed: 0, sent: 0, undelivered: 0 });
  });

  it('sends each claimed row exactly once', async () => {
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    await dispatchDueRemindersService();

    expect(pushClient.send).toHaveBeenCalledTimes(1);
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('gives every run a distinct claim id so two runs never share a claim', async () => {
    givenDue([buildOccurrence()]);

    await dispatchDueRemindersService();
    await dispatchDueRemindersService();

    const [first, second] = occurrenceRepo.claimForDispatch.mock.calls.map(call => call[1]);
    expect(first).not.toEqual(second);
  });

  it('releases claims abandoned by a crashed run before selecting, so they are not stranded', async () => {
    await dispatchDueRemindersService();

    expect(occurrenceRepo.releaseStaleClaims).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 15 * 60 * 1000)
    );
    const releaseOrder = occurrenceRepo.releaseStaleClaims.mock.invocationCallOrder[0];
    const findOrder = occurrenceRepo.findDueForDispatch.mock.invocationCallOrder[0];
    expect(releaseOrder).toBeLessThan(findOrder);
  });

  it('skips the claim round trip when nothing is due', async () => {
    givenDue([]);

    await dispatchDueRemindersService();

    expect(occurrenceRepo.findByClaimId).not.toHaveBeenCalled();
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

/**
 * The timed reminder email rides the same claim as the push, which is what makes it exactly-once.
 * These cases pin that relationship rather than the email's contents — a second guard here would
 * be a second source of truth about whether a reminder has already gone out.
 */
describe('dispatchDueRemindersService — timed reminder emails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    givenDue([]);
    occurrenceRepo.releaseStaleClaims.mockResolvedValue(0);
    occurrenceRepo.updateStatus.mockResolvedValue(true);
    occurrenceRepo.markMissedBefore.mockResolvedValue(0);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    extendPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({
      data: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      status: 200,
    });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
  });

  it('emails once per claimed occurrence and counts it', async () => {
    givenDue([buildOccurrence(), buildOccurrence('507f1f77bcf86cd799439066')]);

    const result = await dispatchDueRemindersService();

    expect(sendReminderEmail).toHaveBeenCalledTimes(2);
    expect('emailedReminders' in result.data && result.data.emailedReminders).toBe(2);
  });

  it('emails nothing for a row another run claimed first', async () => {
    // Found by this run, won by another: the loop only ever walks rows carrying its own claim.
    givenDue([buildOccurrence()], []);

    await dispatchDueRemindersService();

    expect(sendReminderEmail).not.toHaveBeenCalled();
  });

  it('builds one sender per run, so the patient and clinic are read once each', async () => {
    givenDue([buildOccurrence(), buildOccurrence('507f1f77bcf86cd799439066')]);

    await dispatchDueRemindersService();

    expect(makeReminderSender).toHaveBeenCalledTimes(1);
  });

  it('still marks the occurrence sent when the email could not be delivered', async () => {
    // The push may well have landed, and leaving the row pending would re-send it forever.
    sendReminderEmail = vi.fn().mockResolvedValue(false);
    makeReminderSender.mockReturnValue(sendReminderEmail);
    givenDue([buildOccurrence()]);

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(
      OCCURRENCE_ID,
      expect.objectContaining({ status: 'sent' })
    );
    expect('emailedReminders' in result.data && result.data.emailedReminders).toBe(0);
  });

  it('counts reminder emails apart from the daily digest', async () => {
    givenDue([buildOccurrence()]);
    sendDigests.mockResolvedValue({
      data: { considered: 3, sent: 3, failed: 0, skipped: 0 },
      status: 200,
    });

    const result = await dispatchDueRemindersService();

    // A digest that stops arriving is a scheduling bug; a reminder that stops is a dispatch bug.
    expect('emailed' in result.data && result.data.emailed).toBe(3);
    expect('emailedReminders' in result.data && result.data.emailedReminders).toBe(1);
  });
});
