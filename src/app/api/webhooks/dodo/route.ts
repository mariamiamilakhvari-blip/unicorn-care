import { NextRequest, NextResponse } from 'next/server';

import {
  applySubscriptionEventService,
  DodoWebhookEvent,
} from '@/features/clinic/service/billing.service';
import { dodoClient } from '@/shared/lib/dodo-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dodo Payments webhook receiver — the only path that grants a paid plan.
 *
 * The body is read with `req.text()` and verified before it is parsed: signatures cover the exact
 * bytes sent, so parsing and re-serialising first would break verification and, worse, would mean
 * acting on a payload before knowing it is genuine.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const verified = dodoClient.verifyWebhook(rawBody, {
      id: req.headers.get('webhook-id'),
      timestamp: req.headers.get('webhook-timestamp'),
      signature: req.headers.get('webhook-signature'),
    });

    if (!verified) {
      console.error('[dodo:webhook] rejected an unverified request');
      return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    }

    let event: DodoWebhookEvent;
    try {
      event = JSON.parse(rawBody) as DodoWebhookEvent;
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const { data, status } = await applySubscriptionEventService(event);
    return NextResponse.json(data, { status });
  } catch (error) {
    // A 500 makes Dodo retry, which is what we want for a transient fault on our side.
    console.error('[dodo:webhook] failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
