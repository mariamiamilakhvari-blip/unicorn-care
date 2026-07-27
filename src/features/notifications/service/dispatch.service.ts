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
 * Every selected occurrence leaves this run as `sent`, even when nothing could be delivered.
 * Leaving it `pending` would make the next run pick it up again forever; the `undelivered`
 * counter is what surfaces the failure to the clinic adherence view instead.
 */
export async function dispatchDueRemindersService(): Promise<ServiceResult<DispatchSummary>> {
  const now = clock.now();
  const due = await reminderOccurrenceRepository.findDueForDispatch(
    now,
    GRACE_HOURS,
    DISPATCH_LIMIT
  );

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
