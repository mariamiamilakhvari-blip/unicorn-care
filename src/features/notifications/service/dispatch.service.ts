import { randomUUID } from 'node:crypto';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
import { canClinicDispatch } from '@/features/clinic/service/subscription.service';
import {
  createReminderEmailSender,
  sendDailyDigestsService,
} from '@/features/notifications/service/email-dispatch.service';
import { sendToPatientService } from '@/features/notifications/service/push.service';
import { DispatchSummary } from '@/features/notifications/types/push.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
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
 * Sized against the cadence: the Vercel cron calls the sweep every minute, so a run carries about a
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
 * Whether this patient still consents to automated messages, memoised for one sweep.
 *
 * The gate has to sit here rather than inside the push service, which takes a patient id and no
 * clinic and so cannot make the tenancy-scoped read. Here the occurrence carries both, and a run's
 * rows cluster hard enough — one patient's four daily doses — that the memo turns a per-row lookup
 * into one read per patient.
 *
 * Fails closed. If the patient cannot be read at all there is no evidence of a standing consent,
 * and sending a health reminder to someone the platform cannot resolve is the worse of the two
 * mistakes. The email sender re-checks the same flag from the record it loads anyway; that
 * duplication is deliberate, since either path reaching a patient who withdrew would be a breach
 * of a withdrawal the law says takes effect when it is made.
 */
function createConsentGate() {
  const allowed = new Map<string, boolean>();

  return async function mayNotify(patientId: string, clinicId: string): Promise<boolean> {
    const cached = allowed.get(patientId);
    if (cached !== undefined) return cached;

    const patient = await patientRepository.findById(patientId, clinicId);
    const may = Boolean(patient) && !patient?.notificationsRevokedAt;
    allowed.set(patientId, may);
    return may;
  };
}

/**
 * Whether the clinic behind an occurrence may still have reminders sent, memoised for one sweep.
 *
 * This is the *dispatch* gate, not the write gate, and the difference is the whole design. A
 * clinic loses the ability to add patients and build care plans the instant its subscription
 * lapses; its existing reminders keep going for a further fourteen days, because the patient
 * halfway through a course of antibiotics had no part in the billing and a missed dose in that
 * window is a clinical outcome, not an account state. See `DISPATCH_GRACE_DAYS`.
 *
 * A run's rows cluster by clinic — one practice's whole caseload arrives together — so this is one
 * read per clinic per sweep rather than one per reminder.
 *
 * Fails closed, like the consent gate: a clinic that cannot be read is not a clinic we can send a
 * message on behalf of. The difference is what happens to the row, and it is deliberate — see the
 * filter in the sweep.
 */
function createSubscriptionGate() {
  const allowed = new Map<string, boolean>();

  return async function maySend(clinicId: string): Promise<boolean> {
    const cached = allowed.get(clinicId);
    if (cached !== undefined) return cached;

    const may = await canClinicDispatch(clinicId);
    allowed.set(clinicId, may);
    return may;
  };
}

/**
 * The sweep (PRD 04 §"The sweep"). Runs unscoped by clinic — the cron is the platform,
 * authorised by `CRON_SECRET`, and has no clinic session.
 *
 * The Vercel cron calls this every minute, and a manual run from the GitHub workflow may land on
 * top of one. A run lasting more than a minute also overruns into the next one — which the minute
 * cadence makes routine rather than exceptional, since the budget allows 45 seconds. Selecting rows and marking them afterwards left a window where both runs
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

  const dueCandidates = await reminderOccurrenceRepository.findDueForDispatch(
    now,
    GRACE_HOURS,
    DISPATCH_LIMIT
  );

  /*
    Rows belonging to a clinic past its 14-day grace window are dropped *before* the claim, not
    skipped after it.

    That ordering is the whole point. Everything past the claim leaves the run marked `sent`, and
    marking an unsent reminder `sent` would retire it for good — a clinic that upgrades an hour
    later would never see the doses it missed, and neither would the patient. Left unclaimed the
    row stays `pending`: it is picked up untouched by the next sweep, so resubscribing resumes the
    reminders for anything still inside the six-hour dispatch grace, and past that window it ages
    into `missed` like any other reminder nobody sent. Missed is the honest record here — nothing
    was delivered.

    Note the two unrelated windows sharing the word "grace": `GRACE_HOURS` is how late a single
    reminder is still worth sending, and `DISPATCH_GRACE_DAYS` is how long a lapsed clinic's
    reminders keep running at all. They are independent, and a row can be inside one and outside
    the other.
  */
  const maySend = createSubscriptionGate();
  const candidates = [];
  let suspended = 0;
  for (const candidate of dueCandidates) {
    if (await maySend(candidate.clinicId.toString())) {
      candidates.push(candidate);
      continue;
    }
    suspended += 1;
  }

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

  /* One consent read per patient per run, for the same clustering reason. */
  const mayNotify = createConsentGate();

  const deadline = now.getTime() + RUN_BUDGET_MS;
  let processed = 0;
  let failed = 0;
  let abandoned = 0;
  let withheld = 0;

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
      /*
        A withdrawn consent retires the row without sending anything.

        Marked `sent` rather than left pending, for the same reason a row nobody could be reached
        on is: leaving it would have the next run pick it up forever. Both delivery fields are
        `false`, which is the honest record — nothing landed — and the counters below treat it as
        undelivered, so a clinic looking at adherence sees a patient who is not being reminded
        rather than a run that quietly did nothing.
      */
      if (!(await mayNotify(occurrence.patientId.toString(), occurrence.clinicId.toString()))) {
        await reminderOccurrenceRepository.updateStatus(occurrence._id.toString(), {
          status: 'sent',
          sentAt: now,
          pushDelivered: false,
          emailDelivered: false,
        });
        withheld += 1;
        processed += 1;
        continue;
      }

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
      withheld,
      suspended,
    },
    status: 200,
  };
}
