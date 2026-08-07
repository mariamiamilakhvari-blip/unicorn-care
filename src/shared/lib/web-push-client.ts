import { sendNotification, setVapidDetails, WebPushError } from 'web-push';

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  occurrenceId: string;
  tag: string;
};

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushResult = { ok: true } | { ok: false; statusCode: number; gone: boolean };

/** 404/410 mean the browser dropped the subscription — deactivate the row (PRD 01 §8). */
const GONE_STATUS_CODES = [404, 410];

/**
 * Server-only wrapper around `web-push` (PRD 04). Never throws — a failed send returns the
 * failure shape so the dispatch sweep can keep going through the rest of the batch.
 */
/** Bound on one push. Generous against a healthy endpoint, decisive against a dead one. */
const PUSH_TIMEOUT_MS = 10_000;

class WebPushClient {
  private configured = false;

  async send(sub: PushSubscriptionKeys, payload: PushPayload): Promise<PushResult> {
    try {
      this.configure();
      await sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        /*
          A push endpoint that accepts a connection and then goes quiet would otherwise hold this
          send open indefinitely. The sweep sends sequentially, so one such endpoint costs every
          patient behind it in the run.
        */
        { timeout: PUSH_TIMEOUT_MS }
      );
      return { ok: true };
    } catch (error) {
      return this.toFailure(error);
    }
  }

  /** Lazy so a missing VAPID env var fails a single send rather than module import. */
  private configure(): void {
    if (this.configured) return;
    setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    this.configured = true;
  }

  private toFailure(error: unknown): PushResult {
    if (error instanceof WebPushError) {
      return {
        ok: false,
        statusCode: error.statusCode,
        gone: GONE_STATUS_CODES.includes(error.statusCode),
      };
    }
    return { ok: false, statusCode: 0, gone: false };
  }
}

export const webPushClient = new WebPushClient();
export { WebPushClient };
