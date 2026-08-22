import { timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { dispatchDueRemindersService } from '@/features/notifications/service/dispatch.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Constant-time bearer check. This endpoint is publicly reachable and mutates state, so it is
 * authorised before anything else runs — no DB connection, no sweep, on an unauthorised call.
 * `timingSafeEqual` throws on mismatched lengths, so the length guard runs first (and length
 * alone is not a useful oracle for a fixed-format `Bearer <secret>` header).
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization');
  if (!header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header);
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}

/**
 * Called with `Authorization: Bearer ${CRON_SECRET}` by the Vercel cron in `vercel.json`, every
 * minute, which is what makes a reminder arrive near its time.
 *
 * It has been three schedulers. GitHub Actions delivered about one run an hour against a
 * five-minute cron, so the cadence moved to cron-job.org; that ran until a `CRON_SECRET`
 * overwritten with an unrelated key gave it eight days of 401s, after which cron-job.org
 * auto-disabled the job and nobody was told. The only sweeps for a week were the daily Hobby-plan
 * backstop, and every dose more than six hours old was marked missed instead of sent.
 *
 * Both of those failures were invisible because the scheduler lived outside the deployment. It
 * now ships with it: the schedule is in `vercel.json`, and a Pro plan allows the minute cadence
 * the sweep was always sized for.
 *
 * `.github/workflows/dispatch-reminders.yml` can still fire a sweep by hand. Concurrent callers
 * are safe — a row is claimed before anything is sent, so a manual run alongside the schedule
 * cannot double-send.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { data, status } = await dispatchDueRemindersService();
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
