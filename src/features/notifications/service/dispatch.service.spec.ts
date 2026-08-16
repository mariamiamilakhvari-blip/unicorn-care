import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    findDueForDispatch: vi.fn(),
    claimForDispatch: vi.fn(),
    findByClaimId: vi.fn(),
    releaseStaleClaims: vi.fn(),
    releaseClaim: vi.fn(),
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

vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { completeFinishedPlans: vi.fn() },
}));

vi.mock('@/features/notifications/service/email-dispatch.service', () => ({
  sendDailyDigestsService: vi.fn(),
  createReminderEmailSender: vi.fn(),
}));

/*
  The sweep reads the patient to check consent to automated messages before it sends anything.
  Mocked to a consenting patient by default, so only the cases that are about withdrawal have to
  say anything about it.
*/
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

/*
  The sweep also checks whether the clinic behind each occurrence may still have reminders sent —
  which is true for fourteen days after a lapse, not just while the subscription is live. Mocked
  at the service boundary rather than at `clinicRepository`, so these tests say nothing about how
  the grace window is computed; that is `subscription.service.spec`'s subject. Defaults to a clinic
  that may send, so only the suspension cases have to say anything about billing at all.
*/
vi.mock('@/features/clinic/service/subscription.service', () => ({
  canClinicDispatch: vi.fn(),
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import { canClinicDispatch } from '@/features/clinic/service/subscription.service';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { PushSubscriptionDocument } from '@/features/notifications/schema/push-subscription.schema';
import {
  createReminderEmailSender,
  sendDailyDigestsService,
} from '@/features/notifications/service/email-dispatch.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { webPushClient } from '@/shared/lib/web-push-client';

import { dispatchDueRemindersService } from './dispatch.service';

const occurrenceRepo = vi.mocked(reminderOccurrenceRepository);
const subscriptionRepo = vi.mocked(pushSubscriptionRepository);
const pushClient = vi.mocked(webPushClient);
const extendPlans = vi.mocked(extendActivePlansService);
const plans = vi.mocked(carePlanRepository);
const sendDigests = vi.mocked(sendDailyDigestsService);
const makeReminderSender = vi.mocked(createReminderEmailSender);
const patientRepo = vi.mocked(patientRepository);
const clinicMaySend = vi.mocked(canClinicDispatch);

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

/**
 * A patient who consents to being messaged. `notificationsRevokedAt: null` is the whole point of
 * it — the sweep withholds every send when that field carries a date.
 */
const buildPatient = (notificationsRevokedAt: Date | null = null) =>
  ({ _id: new mongoose.Types.ObjectId(PATIENT_ID), notificationsRevokedAt }) as never;

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
    plans.completeFinishedPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({ data: { considered: 0, sent: 0, failed: 0, skipped: 0 }, status: 200 });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
    // A patient who still consents to automated messages, which is every case but the two below.
    patientRepo.findById.mockResolvedValue(buildPatient());
    // A clinic whose reminders may still go out, which is every case but the suspension block.
    clinicMaySend.mockResolvedValue(true);
  });

  it('queries the 6h window with the 500 cap and marks a delivered occurrence sent', async () => {
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.findDueForDispatch).toHaveBeenCalledWith(NOW, 6, 500);
    /*
      What each channel managed is written with the status. `status: 'sent'` only says the sweep
      handled the row — it is set even when nothing reached the patient — so deliverability has to
      be recorded separately or a report off this data would read ~100% regardless of reality.
    */
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
      pushDelivered: true,
      emailDelivered: true,
    });
    expect(result.data).toMatchObject({ processed: 1, sent: 1, undelivered: 0 });
  });

  /*
    Withdrawing consent to automated messages is a right the Law of Georgia on Personal Data
    Protection says takes effect when it is exercised, so it has to bind the sweep rather than the
    next regeneration. These cases pin that it stops both channels, retires the row anyway, and is
    counted apart from a delivery failure.
  */
  describe('withdrawn consent', () => {
    beforeEach(() => {
      patientRepo.findById.mockResolvedValue(buildPatient(new Date('2026-07-20T00:00:00.000Z')));
      subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
      pushClient.send.mockResolvedValue({ ok: true });
    });

    it('sends neither push nor email', async () => {
      givenDue([buildOccurrence()]);

      await dispatchDueRemindersService();

      expect(pushClient.send).not.toHaveBeenCalled();
      expect(sendReminderEmail).not.toHaveBeenCalled();
    });

    it('retires the row rather than leaving it for the next run to pick up forever', async () => {
      givenDue([buildOccurrence()]);

      await dispatchDueRemindersService();

      expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
        status: 'sent',
        sentAt: NOW,
        pushDelivered: false,
        emailDelivered: false,
      });
    });

    it('counts it as withheld, not as undelivered — the sweep worked correctly', async () => {
      givenDue([buildOccurrence()]);

      const result = await dispatchDueRemindersService();

      expect(result.data).toMatchObject({ processed: 1, withheld: 1, sent: 0, undelivered: 0 });
    });

    it('reads the patient once for a run carrying several of their reminders', async () => {
      givenDue([buildOccurrence(), buildOccurrence('507f1f77bcf86cd799439066')]);

      await dispatchDueRemindersService();

      // A sweep can carry hundreds of rows and they cluster per patient; without the memo this is
      // one consent query per dose.
      expect(patientRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('withholds when the patient cannot be read at all, rather than sending anyway', async () => {
      givenDue([buildOccurrence()]);
      patientRepo.findById.mockResolvedValue(null);

      const result = await dispatchDueRemindersService();

      expect(pushClient.send).not.toHaveBeenCalled();
      expect(result.data).toMatchObject({ withheld: 1 });
    });
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
      // Retired so the sweep cannot loop, with each channel's real outcome recorded.
      pushDelivered: false,
      emailDelivered: true,
    });
    // The push endpoint was gone but the email arrived, so the patient was reminded.
    expect(result.data).toMatchObject({ processed: 1, sent: 1, undelivered: 0, unreachable: 0 });
  });

  /**
   * The genuinely unreachable case: no push subscription and no email either. The row is still
   * retired so the sweep cannot loop on it forever, but it is counted apart from a delivery that
   * was attempted and failed — this one is a missing contact detail, which only the clinic can
   * fix, and no amount of retrying will help.
   */
  it('counts a reminder with no live channel at all as unreachable', async () => {
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    sendReminderEmail = vi.fn().mockResolvedValue(false);
    makeReminderSender.mockReturnValue(sendReminderEmail);

    const result = await dispatchDueRemindersService();

    expect(result.data).toMatchObject({ processed: 1, sent: 0, undelivered: 1, unreachable: 1 });
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
      pushDelivered: false,
      emailDelivered: true,
    });
    /*
      Counted as sent, because it was: the email reached them. This assertion read
      `sent: 0, undelivered: 1`, which encoded the counting bug rather than the test's intent —
      the two channels are independent, and a patient with an address but no push permission is
      the ordinary case, not a failure. The retirement this test is actually about is the
      `updateStatus` call above.
    */
    expect(result.data).toMatchObject({ processed: 1, sent: 1, undelivered: 0 });
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
    plans.completeFinishedPlans.mockResolvedValue(0);

    const result = await dispatchDueRemindersService();

    expect(extendPlans).toHaveBeenCalledWith(NOW);
    expect(result).toMatchObject({ status: 200 });
    expect(result.data).toMatchObject({ extendedPlans: 3 });
  });

  /**
   * `completed` existed in the plan status enum from the start and nothing ever set it, so every
   * finished plan stayed `active` forever. The sweep is where it gets set, and it has to happen
   * before the extension step: extending a plan that has already ended is exactly the work the
   * churn guards refuse, and doing it in the other order asks them to refuse it every five
   * minutes rather than not asking at all.
   */
  it('retires plans that have reached their end date, before extending anything', async () => {
    plans.completeFinishedPlans.mockResolvedValue(2);

    const result = await dispatchDueRemindersService();

    expect(plans.completeFinishedPlans).toHaveBeenCalledWith(NOW);
    expect(result.data).toMatchObject({ completedPlans: 2 });
    expect(plans.completeFinishedPlans.mock.invocationCallOrder[0]).toBeLessThan(
      extendPlans.mock.invocationCallOrder[0]
    );
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
    plans.completeFinishedPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({
      data: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      status: 200,
    });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
    // A patient who still consents to automated messages, which is every case but the two below.
    patientRepo.findById.mockResolvedValue(buildPatient());
    // A clinic whose reminders may still go out, which is every case but the suspension block.
    clinicMaySend.mockResolvedValue(true);
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

/**
 * Resilience. The sweep is a sequential loop over hundreds of network calls, and before these
 * guards one bad row took the whole run with it — every remaining occurrence left claimed, so
 * unreachable for the fifteen-minute stale window. One patient's dead endpoint became an outage
 * for everyone behind them in the queue.
 */
describe('dispatchDueRemindersService — resilience', () => {
  const SECOND_ID = '507f1f77bcf86cd799439066';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    givenDue([]);
    occurrenceRepo.releaseStaleClaims.mockResolvedValue(0);
    occurrenceRepo.releaseClaim.mockResolvedValue(0);
    occurrenceRepo.updateStatus.mockResolvedValue(true);
    occurrenceRepo.markMissedBefore.mockResolvedValue(0);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    extendPlans.mockResolvedValue(0);
    plans.completeFinishedPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({
      data: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      status: 200,
    });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
    // A patient who still consents to automated messages, which is every case but the two below.
    patientRepo.findById.mockResolvedValue(buildPatient());
    // A clinic whose reminders may still go out, which is every case but the suspension block.
    clinicMaySend.mockResolvedValue(true);
  });

  it('keeps going after one occurrence throws', async () => {
    givenDue([buildOccurrence(), buildOccurrence(SECOND_ID)]);
    subscriptionRepo.findActiveByPatient
      .mockRejectedValueOnce(new Error('endpoint lookup exploded'))
      .mockResolvedValueOnce([]);

    const result = await dispatchDueRemindersService();

    // The second row was still attempted.
    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(SECOND_ID, expect.anything());
    expect('failed' in result.data && result.data.failed).toBe(1);
  });

  it('retires a thrown occurrence as undelivered rather than leaving it claimed', async () => {
    // Left claimed it is stranded for the stale window; left pending it may be sent twice.
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockRejectedValue(new Error('boom'));

    await dispatchDueRemindersService();

    expect(occurrenceRepo.updateStatus).toHaveBeenCalledWith(OCCURRENCE_ID, {
      status: 'sent',
      sentAt: NOW,
      pushDelivered: false,
      emailDelivered: false,
    });
  });

  it('survives a failure to retire, rather than losing the rest of the run', async () => {
    givenDue([buildOccurrence(), buildOccurrence(SECOND_ID)]);
    subscriptionRepo.findActiveByPatient.mockRejectedValue(new Error('boom'));
    occurrenceRepo.updateStatus.mockRejectedValue(new Error('database gone'));

    const result = await dispatchDueRemindersService();

    expect(result.status).toBe(200);
    expect('failed' in result.data && result.data.failed).toBe(2);
  });

  it('stops at the run budget and hands the untouched rows straight back', async () => {
    givenDue([buildOccurrence(), buildOccurrence(SECOND_ID)]);
    // The first send takes the whole budget; the second must not be attempted.
    subscriptionRepo.findActiveByPatient.mockImplementation(async () => {
      vi.setSystemTime(new Date(NOW.getTime() + 46_000));
      return [];
    });

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.updateStatus).toHaveBeenCalledTimes(1);
    expect('abandoned' in result.data && result.data.abandoned).toBe(1);
    // Released now, not left to the fifteen-minute stale sweep.
    expect(occurrenceRepo.releaseClaim).toHaveBeenCalled();
  });

  it('does not release a claim when the whole run completed', async () => {
    givenDue([buildOccurrence()]);

    await dispatchDueRemindersService();

    expect(occurrenceRepo.releaseClaim).not.toHaveBeenCalled();
  });
});

/**
 * The subscription gate.
 *
 * A clinic whose trial ran out stops being able to send reminders, but the reminders themselves
 * are clinical records that outlive the billing problem. So the gate drops the row *before* the
 * claim rather than skipping it after: everything past the claim leaves the run marked `sent`,
 * and marking an unsent dose reminder `sent` would retire it permanently — a clinic that
 * subscribes an hour later would never learn the patient was not reminded, and neither would the
 * patient.
 */
describe('dispatchDueRemindersService — subscription gate', () => {
  const OTHER_CLINIC_ID = '507f1f77bcf86cd799439077';
  const SECOND_ID = '507f1f77bcf86cd799439066';

  /** The same occurrence, attributed to a different practice. */
  const forClinic = (id: string, clinicId: string): ReminderOccurrenceDocument => ({
    ...buildOccurrence(id),
    clinicId: new mongoose.Types.ObjectId(clinicId),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    givenDue([]);
    occurrenceRepo.releaseStaleClaims.mockResolvedValue(0);
    occurrenceRepo.releaseClaim.mockResolvedValue(0);
    occurrenceRepo.updateStatus.mockResolvedValue(true);
    occurrenceRepo.markMissedBefore.mockResolvedValue(0);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([]);
    extendPlans.mockResolvedValue(0);
    plans.completeFinishedPlans.mockResolvedValue(0);
    sendDigests.mockResolvedValue({
      data: { considered: 0, sent: 0, failed: 0, skipped: 0 },
      status: 200,
    });
    sendReminderEmail = vi.fn().mockResolvedValue(true);
    makeReminderSender.mockReturnValue(sendReminderEmail);
    patientRepo.findById.mockResolvedValue(buildPatient());
    clinicMaySend.mockResolvedValue(true);
  });

  /*
    "Lapsed" is not the gate. A clinic whose trial ended yesterday still has its reminders sent —
    `canClinicDispatch` is what draws the line, fourteen days later, and the sweep asks it rather
    than reading a status itself.
  */
  it('keeps sending for a clinic still inside its 14-day grace window', async () => {
    givenDue([buildOccurrence()]);
    subscriptionRepo.findActiveByPatient.mockResolvedValue([buildSubscription('https://fcm/a')]);
    pushClient.send.mockResolvedValue({ ok: true });
    // Lapsed, but inside the window — the gate says yes.
    clinicMaySend.mockResolvedValue(true);

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.claimForDispatch).toHaveBeenCalledWith(
      [OCCURRENCE_ID],
      expect.anything(),
      NOW
    );
    expect('sent' in result.data && result.data.sent).toBe(1);
    expect('suspended' in result.data && result.data.suspended).toBe(0);
  });

  it('never claims a row once the grace window has closed, so nothing is sent or retired', async () => {
    givenDue([buildOccurrence()], []);
    clinicMaySend.mockResolvedValue(false);

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.claimForDispatch).toHaveBeenCalledWith([], expect.anything(), NOW);
    expect(pushClient.send).not.toHaveBeenCalled();
    expect(sendReminderEmail).not.toHaveBeenCalled();
    // Not marked `sent` — the row stays pending and the next sweep can still pick it up.
    expect(occurrenceRepo.updateStatus).not.toHaveBeenCalled();
    expect('suspended' in result.data && result.data.suspended).toBe(1);
  });

  it('counts a suspended row apart from a withheld one', async () => {
    // Withholding is the platform obeying a withdrawn consent; suspension is a billing wall.
    // Folding them together would have a clinic chasing a consent problem that does not exist.
    givenDue([buildOccurrence()], []);
    clinicMaySend.mockResolvedValue(false);

    const result = await dispatchDueRemindersService();

    expect('withheld' in result.data && result.data.withheld).toBe(0);
    expect('suspended' in result.data && result.data.suspended).toBe(1);
  });

  it('sends for a paying clinic in the same run that suspends another', async () => {
    const live = forClinic(OCCURRENCE_ID, CLINIC_ID);
    const lapsed = forClinic(SECOND_ID, OTHER_CLINIC_ID);
    givenDue([live, lapsed], [live]);
    clinicMaySend.mockImplementation(async clinicId => clinicId === CLINIC_ID);

    const result = await dispatchDueRemindersService();

    expect(occurrenceRepo.claimForDispatch).toHaveBeenCalledWith(
      [OCCURRENCE_ID],
      expect.anything(),
      NOW
    );
    expect('processed' in result.data && result.data.processed).toBe(1);
    expect('suspended' in result.data && result.data.suspended).toBe(1);
  });

  it('reads each clinic once however many rows it has in the run', async () => {
    // A practice's whole caseload arrives together; a lookup per reminder would be a read storm.
    givenDue([buildOccurrence(), buildOccurrence(SECOND_ID)]);

    await dispatchDueRemindersService();

    expect(clinicMaySend).toHaveBeenCalledTimes(1);
  });
});
