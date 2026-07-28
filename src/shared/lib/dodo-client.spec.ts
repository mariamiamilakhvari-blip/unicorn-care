import { createHmac } from 'crypto';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { dodoClient, DodoClient } from '@/shared/lib/dodo-client';

const SECRET = 'whsec_c2VjcmV0LWtleS1mb3ItdGVzdGluZw==';

const INPUT = {
  lines: [{ productId: 'pdt_standard_yearly', quantity: 1 }],
  returnUrl: 'https://app.example/billing?status=success',
  cancelUrl: 'https://app.example/billing?status=cancelled',
  customerEmail: 'owner@clinic.ge',
  customerName: 'Gold Esthetic',
  metadata: { clinicId: '507f1f77bcf86cd799439011', plan: 'standard' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Builds a signature the way Dodo does, so verification is tested against a real one. */
function sign(id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  const digest = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return `v1,${digest}`;
}

beforeEach(() => {
  process.env.DODO_PAYMENTS_API_KEY = 'test-key';
  process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
  process.env.DODO_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createCheckoutSession', () => {
  it('returns the checkout url and session id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ session_id: 'cks_1', checkout_url: 'https://checkout.example/cks_1' })
      )
    );

    const result = await new DodoClient().createCheckoutSession(INPUT);

    expect(result).toEqual({
      ok: true,
      sessionId: 'cks_1',
      checkoutUrl: 'https://checkout.example/cks_1',
    });
  });

  it('posts the cart, customer and metadata with a bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ session_id: 'cks_1', checkout_url: 'https://x' }));
    vi.stubGlobal('fetch', fetchMock);

    await new DodoClient().createCheckoutSession(INPUT);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.dodopayments.com/checkouts');
    expect(init.headers.Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body.product_cart).toEqual([{ product_id: 'pdt_standard_yearly', quantity: 1 }]);
    // Metadata is the only link back to the clinic when the webhook arrives.
    expect(body.metadata.clinicId).toBe('507f1f77bcf86cd799439011');
  });

  /** A missing or misspelled environment must never be treated as live. */
  it('defaults to test mode and only uses live when explicitly set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ session_id: 'c', checkout_url: 'https://x' }));
    vi.stubGlobal('fetch', fetchMock);

    delete process.env.DODO_PAYMENTS_ENVIRONMENT;
    await new DodoClient().createCheckoutSession(INPUT);
    expect(fetchMock.mock.calls[0][0]).toContain('test.dodopayments.com');

    process.env.DODO_PAYMENTS_ENVIRONMENT = 'LIVE';
    await new DodoClient().createCheckoutSession(INPUT);
    expect(fetchMock.mock.calls[1][0]).toContain('test.dodopayments.com');

    process.env.DODO_PAYMENTS_ENVIRONMENT = 'live_mode';
    await new DodoClient().createCheckoutSession(INPUT);
    expect(fetchMock.mock.calls[2][0]).toContain('live.dodopayments.com');
  });

  it('never throws when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));
    await expect(new DodoClient().createCheckoutSession(INPUT)).resolves.toEqual({
      ok: false,
      statusCode: 0,
      message: 'CHECKOUT_UNREACHABLE',
    });
  });

  it('reports a missing api key without calling out', async () => {
    delete process.env.DODO_PAYMENTS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await new DodoClient().createCheckoutSession(INPUT);

    expect(result).toMatchObject({ ok: false, message: 'DODO_API_KEY_MISSING' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a 200 with no checkout url as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ session_id: 'cks_1' })));
    const result = await new DodoClient().createCheckoutSession(INPUT);
    expect(result).toMatchObject({ ok: false, message: 'CHECKOUT_URL_MISSING' });
  });
});

describe('verifyWebhook', () => {
  const payload = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 's_1' } });
  const id = 'evt_1';

  function now(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  it('accepts a correctly signed payload', () => {
    const timestamp = now();
    const signature = sign(id, timestamp, payload);

    expect(dodoClient.verifyWebhook(payload, { id, timestamp, signature })).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const timestamp = now();
    const signature = sign(id, timestamp, payload);
    const tampered = JSON.stringify({ type: 'subscription.active', data: { subscription_id: 'x' } });

    expect(dodoClient.verifyWebhook(tampered, { id, timestamp, signature })).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const timestamp = now();
    const foreign = createHmac('sha256', Buffer.from('other'))
      .update(`${id}.${timestamp}.${payload}`)
      .digest('base64');

    expect(
      dodoClient.verifyWebhook(payload, { id, timestamp, signature: `v1,${foreign}` })
    ).toBe(false);
  });

  /** Without a timestamp window a captured request could be replayed indefinitely. */
  it('rejects an old timestamp even when the signature matches it', () => {
    const stale = (Math.floor(Date.now() / 1000) - 3600).toString();
    const signature = sign(id, stale, payload);

    expect(dodoClient.verifyWebhook(payload, { id, timestamp: stale, signature })).toBe(false);
  });

  it('rejects when any header is missing', () => {
    const timestamp = now();
    const signature = sign(id, timestamp, payload);

    expect(dodoClient.verifyWebhook(payload, { id: null, timestamp, signature })).toBe(false);
    expect(dodoClient.verifyWebhook(payload, { id, timestamp: null, signature })).toBe(false);
    expect(dodoClient.verifyWebhook(payload, { id, timestamp, signature: null })).toBe(false);
  });

  it('rejects when no signing secret is configured', () => {
    const timestamp = now();
    const signature = sign(id, timestamp, payload);
    delete process.env.DODO_WEBHOOK_SECRET;

    expect(dodoClient.verifyWebhook(payload, { id, timestamp, signature })).toBe(false);
  });
});
