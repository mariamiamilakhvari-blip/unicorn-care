import { NextRequest, NextResponse } from 'next/server';

import {
  EmailDeliveryEvent,
  recordEmailDeliveryEventService,
} from '@/features/notifications/service/email-delivery.service';
import { EmailEventKind } from '@/shared/const/email-delivery.const';
import { verifySvixSignature } from '@/shared/lib/svix-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resend's event names, mapped to the three outcomes this system acts on. */
const EVENT_KINDS: Record<string, EmailEventKind> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

type ResendWebhookBody = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { type?: string; message?: string };
    reason?: string;
  };
};

/** The provider sends `to` as an array; a single string is accepted rather than assumed away. */
function firstRecipient(to: string[] | string | undefined): string {
  if (Array.isArray(to)) return to[0] ?? '';
  return to ?? '';
}

/**
 * Resend delivery webhook — how the platform learns an address is dead.
 *
 * Signed with Svix, the same scheme Dodo uses, so verification is shared. The body is read as
 * text and verified before it is parsed: signatures cover exact bytes, and parsing first would
 * both break verification and mean acting on a payload before knowing it is genuine.
 *
 * Unknown event types are acknowledged with 200 rather than rejected. Resend sends more kinds
 * than this system acts on (`email.sent`, `email.opened`), and a non-2xx makes it retry forever
 * something we will never do anything with.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const verified = verifySvixSignature(
      rawBody,
      {
        id: req.headers.get('svix-id'),
        timestamp: req.headers.get('svix-timestamp'),
        signature: req.headers.get('svix-signature'),
      },
      process.env.RESEND_WEBHOOK_SECRET
    );

    if (!verified) {
      console.error('[resend:webhook] rejected an unverified request');
      return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    }

    let body: ResendWebhookBody;
    try {
      body = JSON.parse(rawBody) as ResendWebhookBody;
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const kind = EVENT_KINDS[body.type ?? ''];
    if (!kind) return NextResponse.json({ ignored: body.type ?? 'unknown' }, { status: 200 });

    const email = firstRecipient(body.data?.to);
    if (!email) return NextResponse.json({ ignored: 'no recipient' }, { status: 200 });

    const event: EmailDeliveryEvent = {
      kind,
      email,
      bounceType: body.data?.bounce?.type ?? '',
      message: body.data?.bounce?.message ?? body.data?.reason ?? '',
      providerId: body.data?.email_id ?? '',
      occurredAt: body.created_at ? new Date(body.created_at) : new Date(),
    };

    const { data, status } = await recordEmailDeliveryEventService(event);
    return NextResponse.json(data, { status });
  } catch (error) {
    // A 500 makes Resend retry, which is right for a transient fault on our side.
    console.error('[resend:webhook] failed', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
