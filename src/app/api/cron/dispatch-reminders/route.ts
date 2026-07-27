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

/** Vercel Cron hits this every 5 minutes with `Authorization: Bearer ${CRON_SECRET}`. */
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
