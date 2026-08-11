import { randomUUID } from 'node:crypto';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import {
  createReminderEmailSender,
  sendDailyDigestsService,
} from '@/features/notifications/service/email-dispatch.service';
import { sendToPatientService } from '@/features/notifications/service/push.service';
import { DispatchSummary } from '@/features/notifications/types/push.types';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { clock } from '@/shared/lib/clock';
import { PushPayload } from '@/shared/lib/web-push-client';
import { ServiceResult } from '@/shared/types/common';

const MS_PER_HOUR = 60 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;

/**
 * How long a claimed row may sit in `sending` before another run may take it back. Comfortably
 * longer than a sweep takes, so a slow run is never robbed of rows it is still working through.
 */
const STALE_CLAIM_MINUTES = 15;

/** How far back a due reminder is still worth sending. Older than this it is `missed` (PRD 04 §6). */
const GRACE_HOURS = 6;

/**
 * Hard ceiling per run so one sweep can never exceed the function timeout (PRD 04 §2).
 *
 * Sized against the cadence: cron-job.org calls the sweep every minute, so a run carries about a
 * minute of backlog and never comes close to this. It was briefly 2000, when GitHub Actions held
 * the schedule and delivered roughly one run an hour — twelve times the backlog, which 500
 * truncated. That is the number to raise again if the scheduler ever falls behind, and the
 * symptom to look for is a sweep returning exactly this many rows.
 *
 * It is the cheaper of two ceilings either way: `RUN_BUDGET_MS` ends a run after 45 seconds, and
 * at three sequential round trips per occurrence that is what binds first on a slow provider.
 */
const DISPATCH_LIMIT = 500;

/**
 * How long this run may spend sending before it stops and hands the rest back.
 *
 * The scheduler calls this over HTTP with a 60-second cap, and every occurrence now costs a push
 * *and* an email — hundreds of sequential round trips that a slow provider can stretch past that
 * window. Being killed mid-run is the bad outcome: the rows already claimed stay in `sending`
 * until the stale-claim window expires, so nobody is reminded of anything for fifteen minutes.
 *
 * Forty-five seconds leaves the caller room to read the response, and the remainder is released
 * immediately for the next run five minutes later.
 */
const RUN_BUDGET_MS = 45_000;

/**
 * Dispatch is a pure read: `title`/`body` were rendered in the patient's locale at generation
 * time (PRD 04 §"Payload shape"), so nothing clinical is composed here.
 */
function toPayload(occurrence: ReminderOccurrenceDocument): PushPayload {
  const occurrenceId = occurrence._id.toString();
  return {
    title: occurrence.title,
    body: occurrence.body ?? '',
    url: PATIENT_PORTAL_ROUTE,
    occurrenceId,
    // Tag by occurrence so a resend replaces the notification rather than stacking it.
    tag: occurrenceId,
  };
}

/** True when at least one of the patient's endpoints accepted the push. */
function wasDelivered(result: Awaited<ReturnType<typeof sendToPatientService>>): boolean {
  return 'sent' in result.data && result.data.sent > 0;
}

/**
 * The sweep (PRD 04 §"The sweep"). Runs unscoped by clinic — the cron is the platform,
 * authorised by `CRON_SECRET`, and has no clinic session.
 *
 * Two schedulers call this: cron-job.org every minute, and the daily Vercel cron as a backstop.
 * They collide every day at 06:00 UTC, and a run lasting more than a minute overruns into the
 * next one — which the minute cadence makes routine rather than exceptional, since the budget
 * allows 45 seconds. Selecting rows and marking them afterwards left a window where both runs
 * read the same `pending` rows and pushed the same medication reminder twice, so selection is a
 * claim: a row is moved to `sending` before anything is sent, and a run only ever sends rows
 * carrying its own claim.
 *
 * Every claimed occurrence leaves this run as `sent`, even when nothing could be delivered.
 * Leaving it `pending` would make the next run pick it up again forever; the `undelivered`
 * counter is what surfaces the failure to the clinic adherence view instead.
 */
export async function dispatchDueRemindersService(): Promise<ServiceResult<DispatchSummary>> {
  const now = clock.now();

  // Recover rows stranded by a run that died mid-send before this run picks candidates, so they
  // are eligible again immediately rather than waiting a further cycle.
  await reminderOccurrenceRepository.releaseStaleClaims(
    new Date(now.getTime() - STALE_CLAIM_MINUTES * MS_PER_MINUTE)
  );

  const candidates = await reminderOccurrenceRepository.findDueForDispatch(
    now,
    GRACE_HOURS,
    DISPATCH_LIMIT
  );

  const claimId = randomUUID();
  await reminderOccurrenceRepository.claimForDispatch(
    candidates.map(candidate => candidate._id.toString()),
    claimId,
    now
  );

  // Re-read by claim rather than trusting `candidates`: a competing run may have taken some of
  // them between the find and the claim, and those rows are not ours to send.
  const due = candidates.length
    ? await reminderOccurrenceRepository.findByClaimId(claimId)
    : [];

  let sent = 0;
  let undelivered = 0;
  let unreachable = 0;
  let emailedReminders = 0;

  /*
    One sender for the whole run: it memoises the patient and clinic behind each occurrence, and a
    run's rows cluster hard — one patient's four daily doses, one clinic's entire caseload.
  */
  const sendReminderEmail = createReminderEmailSender();

  const deadline = now.getTime() + RUN_BUDGET_MS;
  let processed = 0;
  let failed = 0;
  let abandoned = 0;

  for (const occurrence of due) {
    /*
      Stop before the caller does. The scheduler gives this request a fixed window, and a run that
      is killed mid-flight leaves its remaining rows stuck in `sending` until the stale-claim
      window expires — fifteen minutes in which nobody is reminded of anything. Stopping under our
      own power lets the untouched rows go straight back to `pending` below.
    */
    if (clock.now().getTime() > deadline) {
      abandoned = due.length - processed;
      console.warn('[dispatch] run budget reached', { processed, abandoned });
      break;
    }

    /*
      One occurrence's failure is one occurrence's failure. Before this, a throw anywhere in the
      body abandoned every remaining row in the run — still claimed, so not retried for fifteen
      minutes — which turns one patient's dead push endpoint into an outage for everyone behind
      them in the queue.
    */
    try {
      const result = await sendToPatientService(
        occurrence.patientId.toString(),
        toPayload(occurrence)
      );

      /*
        Email rides the same claim as the push, so it inherits exactly-once: this row is already
        out of `pending` and no other run can reach it. Sent after the push because push is the
        faster channel and a patient may have both — the ordering decides which one arrives first,
        and the one that can wake a phone should.
      */
      const emailDelivered = await sendReminderEmail(occurrence);
      if (emailDelivered) emailedReminders += 1;

      const pushDelivered = wasDelivered(result);

      /*
        Both outcomes are written with the status, because this is the only moment either is known.
        `status: 'sent'` means the sweep handled the row and nothing more — a report that read
        deliverability off it would call a dead endpoint and a bounced inbox a success.
      */
      await reminderOccurrenceRepository.updateStatus(occurrence._id.toString(), {
        status: 'sent',
        sentAt: now,
        pushDelivered,
        emailDelivered,
      });
      /*
        Either channel counts. This read `if (pushDelivered)` alone, which reported a reminder
        that arrived by email as undelivered — the two channels are independent by design, and a
        patient who has email but has never granted push notification permission is the ordinary
        case rather than the exception.
      */
      if (pushDelivered || emailDelivered) {
        sent += 1;
      } else {
        undelivered += 1;
        unreachable += 1;
        /*
          Named, not just counted. A row marked `sent` with both channels dead is a reminder that
          reached nobody, and the aggregate alone cannot say which patient it was — so the clinic
          has no way to discover that someone in their care is receiving nothing at all. The
          occurrence id is enough to trace it; the patient's name and address stay out of the log.
        */
        console.warn('[dispatch] reminder reached nobody', {
          occurrenceId: occurrence._id.toString(),
          patientId: occurrence.patientId.toString(),
          kind: occurrence.kind,
        });
      }
    } catch (caught) {
      failed += 1;
      console.error('[dispatch] occurrence failed', occurrence._id.toString(), caught);

      /*
        Retired anyway. Leaving it claimed strands it for the stale window and leaving it pending
        re-runs a send that may already have gone out — and the dose time is passing either way.
        `pushDelivered: false` records that nothing is known to have landed, which is the honest
        answer and the one the adherence and analytics views should show.
      */
      try {
        await reminderOccurrenceRepository.updateStatus(occurrence._id.toString(), {
          status: 'sent',
          sentAt: now,
          pushDelivered: false,
          emailDelivered: false,
        });
      } catch (retireFailed) {
        // The database is the thing that is failing. The stale-claim sweeper is the backstop.
        console.error('[dispatch] could not retire', occurrence._id.toString(), retireFailed);
      }
    }

    processed += 1;
  }

  // Anything claimed and not reached goes back now rather than sitting out the stale window.
  if (abandoned > 0) await reminderOccurrenceRepository.releaseClaim(claimId);

  // Anything still pending past the grace window is beyond useful — the dose time has gone.
  const missed = await reminderOccurrenceRepository.markMissedBefore(
    new Date(now.getTime() - GRACE_HOURS * MS_PER_HOUR)
  );

  /*
    Retire finished plans before extending. A plan whose window has closed is not a candidate for
    anything the sweep does afterwards, and until this existed nothing ever set `completed` — so
    every plan ever activated stayed active for good, was swept forever, and the rating flow had
    no moment to fire on.
  */
  const completedPlans = await carePlanRepository.completeFinishedPlans(now);

  const extendedPlans = await extendActivePlansService(now);

  // Each plan is claimed for its own clinic-local date, so running this on every five-minute sweep
  // still sends a patient exactly one email a day — at their clinic's morning, not a fixed UTC hour.
  const digests = await sendDailyDigestsService();
  const emailed = 'sent' in digests.data ? digests.data.sent : 0;

  return {
    data: {
      processed,
      sent,
      undelivered,
      unreachable,
      missed,
      completedPlans,
      extendedPlans,
      emailed,
      emailedReminders,
      failed,
      abandoned,
    },
    status: 200,
  };
}
