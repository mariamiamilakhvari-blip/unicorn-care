import { createHmac, timingSafeEqual } from 'crypto';

const TEST_BASE_URL = 'https://test.dodopayments.com';
const LIVE_BASE_URL = 'https://live.dodopayments.com';
const REQUEST_TIMEOUT_MS = 20_000;

/** Standard Webhooks tolerates a small clock skew; anything older is a replay. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type CheckoutLine = { productId: string; quantity: number };

export type CheckoutInput = {
  lines: CheckoutLine[];
  returnUrl: string;
  cancelUrl: string;
  customerEmail: string;
  customerName: string;
  /*
    B2B invoice details. All three travel together or not at all: Dodo rejects a `tax_id` that
    arrives without a `billing_address.country`, so a clinic whose free-text country could not be
    resolved to an alpha-2 code gets a plain invoice rather than a failed checkout.
  */
  taxId?: string;
  businessName?: string;
  /** ISO 3166-1 alpha-2. */
  countryCode?: string;
  /** Echoed back on every webhook, and the only way we know which clinic paid. */
  metadata: Record<string, string>;
};

export type CancelResult =
  | { ok: true }
  | { ok: false; statusCode: number; message: string };

export type CheckoutResult =
  | { ok: true; checkoutUrl: string; sessionId: string }
  | { ok: false; statusCode: number; message: string };

type CheckoutResponse = {
  session_id?: string;
  checkout_url?: string | null;
};

/**
 * Server-only wrapper around the Dodo Payments API.
 *
 * Never throws — a failed call returns the failure shape so a billing outage surfaces as "we
 * could not start checkout" rather than a 500.
 */
class DodoClient {
  /** `live_mode` is opt-in: a missing or misspelled value must never reach the live API. */
  private baseUrl(): string {
    return process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? LIVE_BASE_URL : TEST_BASE_URL;
  }

  isLiveMode(): boolean {
    return process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode';
  }

  /**
   * Ends a subscription so billing stops.
   *
   * `PATCH /subscriptions/{id}` with a `cancelled` status is the whole contract — Dodo has no
   * DELETE for subscriptions. A 404 counts as success: the subscription is already gone, and the
   * caller's goal is "this clinic is no longer billed", which is satisfied either way.
   */
  async cancelSubscription(subscriptionId: string): Promise<CancelResult> {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) return { ok: false, statusCode: 0, message: 'DODO_API_KEY_MISSING' };

    try {
      const response = await fetch(`${this.baseUrl()}/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok || response.status === 404) return { ok: true };

      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        statusCode: response.status,
        message: body.message ?? 'CANCEL_FAILED',
      };
    } catch {
      return { ok: false, statusCode: 0, message: 'CANCEL_UNREACHABLE' };
    }
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) return { ok: false, statusCode: 0, message: 'DODO_API_KEY_MISSING' };

    try {
      const response = await fetch(`${this.baseUrl()}/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_cart: input.lines.map(line => ({
            product_id: line.productId,
            quantity: line.quantity,
          })),
          customer: { email: input.customerEmail, name: input.customerName },
          // `tax_id`, `customer_business_name` and `billing_address` are top-level in this API,
          // not nested under `customer`. Spread conditionally so the keys are absent rather than
          // undefined when there is nothing to send.
          ...(input.taxId && input.countryCode ? { tax_id: input.taxId } : {}),
          ...(input.businessName ? { customer_business_name: input.businessName } : {}),
          ...(input.countryCode ? { billing_address: { country: input.countryCode } } : {}),
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const body = (await response.json().catch(() => ({}))) as CheckoutResponse & {
        message?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          statusCode: response.status,
          message: body.message ?? 'CHECKOUT_FAILED',
        };
      }

      if (!body.checkout_url || !body.session_id) {
        return { ok: false, statusCode: response.status, message: 'CHECKOUT_URL_MISSING' };
      }

      return { ok: true, checkoutUrl: body.checkout_url, sessionId: body.session_id };
    } catch {
      return { ok: false, statusCode: 0, message: 'CHECKOUT_UNREACHABLE' };
    }
  }

  /**
   * Standard Webhooks verification: HMAC-SHA256 over `id.timestamp.payload`, compared in constant
   * time, with a timestamp window so a captured request cannot be replayed later.
   *
   * The raw request body must be passed exactly as received — re-serialising parsed JSON changes
   * the bytes and the signature will never match.
   */
  verifyWebhook(rawBody: string, headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  }): boolean {
    const secret = process.env.DODO_WEBHOOK_SECRET;
    if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

    const sentAt = Number(headers.timestamp);
    if (!Number.isFinite(sentAt)) return false;
    const ageSeconds = Math.abs(Date.now() / 1000 - sentAt);
    if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

    // Secrets are issued base64 behind a `whsec_` prefix.
    const key = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice('whsec_'.length), 'base64')
      : Buffer.from(secret, 'utf8');

    const expected = createHmac('sha256', key)
      .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
      .digest('base64');

    // The header carries a space-separated list of `v1,<signature>` entries.
    return headers.signature
      .split(' ')
      .map(part => part.split(',')[1] ?? '')
      .some(candidate => this.constantTimeEquals(candidate, expected));
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    // timingSafeEqual throws on length mismatch, so the length check has to come first.
    if (left.length !== right.length || left.length === 0) return false;
    return timingSafeEqual(left, right);
  }
}

export const dodoClient = new DodoClient();
export { DodoClient };
