import { randomUUID } from 'node:crypto';

import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { extendActivePlansService } from '@/features/care-plan/service/dispatch-extension.service';
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

/** Hard ceiling per run so one sweep can never exceed the function timeout (PRD 04 §2). */
const DISPATCH_LIMIT = 500;

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
 * Two schedulers call this: GitHub Actions every 5 minutes, and the daily Vercel cron as a safety
 * net for when GitHub's best-effort scheduler lags. They collide every day at 06:00 UTC, and a
 * slow 5-minute run also overruns into the next one. Selecting rows and marking them afterwards
 * left a window where both runs read the same `pending` rows and pushed the same medication
 * reminder twice, so selection is a claim: a row is moved to `sending` before anything is sent,
 * and a run only ever sends rows carrying its own claim.
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

  for (const occurrence of due) {
    const result = await sendToPatientService(occurrence.patientId.toString(), toPayload(occurrence));
    await reminderOccurrenceRepository.updateStatus(occurrence._id.toString(), {
      status: 'sent',
      sentAt: now,
    });
    if (wasDelivered(result)) sent += 1;
    else undelivered += 1;
  }

  // Anything still pending past the grace window is beyond useful — the dose time has gone.
  const missed = await reminderOccurrenceRepository.markMissedBefore(
    new Date(now.getTime() - GRACE_HOURS * MS_PER_HOUR)
  );

  const extendedPlans = await extendActivePlansService(now);

  return {
    data: { processed: due.length, sent, undelivered, missed, extendedPlans },
    status: 200,
  };
}
