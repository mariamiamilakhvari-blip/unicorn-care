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

  /*
    The B2B invoice fields are top-level in this API, not nested under `customer`. Pinned because
    getting the nesting wrong fails silently: Dodo accepts the request and issues an invoice with
    no VAT number on it, which nobody notices until a clinic's accountant asks for one.
  */
  it('sends the tax id, business name and billing country at the top level', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ session_id: 'cks_1', checkout_url: 'https://x' }));
    vi.stubGlobal('fetch', fetchMock);

    await new DodoClient().createCheckoutSession({
      ...INPUT,
      taxId: '204567891',
      businessName: 'Gold Esthetic',
      countryCode: 'GE',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tax_id).toBe('204567891');
    expect(body.customer_business_name).toBe('Gold Esthetic');
    expect(body.billing_address).toEqual({ country: 'GE' });
    expect(body.customer.tax_id).toBeUndefined();
  });

  /*
    Dodo rejects a `tax_id` with no `billing_address.country`. A clinic whose free-text country
    could not be resolved must still be able to pay, so the tax id is dropped rather than sent
    alone — a plain invoice beats a checkout that 422s.
  */
  it('omits the tax id when the country could not be resolved', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ session_id: 'cks_1', checkout_url: 'https://x' }));
    vi.stubGlobal('fetch', fetchMock);

    await new DodoClient().createCheckoutSession({
      ...INPUT,
      taxId: '204567891',
      businessName: 'Gold Esthetic',
      countryCode: undefined,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect('tax_id' in body).toBe(false);
    expect('billing_address' in body).toBe(false);
    // The business name is independent of tax registration, so it still travels.
    expect(body.customer_business_name).toBe('Gold Esthetic');
  });

  it('omits every billing key when the clinic supplied none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ session_id: 'cks_1', checkout_url: 'https://x' }));
    vi.stubGlobal('fetch', fetchMock);

    await new DodoClient().createCheckoutSession(INPUT);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect('tax_id' in body).toBe(false);
    expect('customer_business_name' in body).toBe(false);
    expect('billing_address' in body).toBe(false);
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

describe('cancelSubscription', () => {
  beforeEach(() => {
    vi.stubEnv('DODO_PAYMENTS_API_KEY', 'test-key');
    vi.stubEnv('DODO_PAYMENTS_ENVIRONMENT', 'test_mode');
  });

  it('PATCHes the subscription to cancelled', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const result = await dodoClient.cancelSubscription('sub_1');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://test.dodopayments.com/subscriptions/sub_1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'cancelled' });
  });

  /** The caller wants "no longer billed"; an already-absent subscription satisfies that. */
  it('treats a 404 as success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));

    expect(await dodoClient.cancelSubscription('sub_gone')).toEqual({ ok: true });
  });

  it('reports a failure rather than throwing, so deletion can abort cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'nope' }), { status: 500 })
    );

    const result = await dodoClient.cancelSubscription('sub_1');

    expect(result).toEqual({ ok: false, statusCode: 500, message: 'nope' });
  });

  it('reports a network failure instead of propagating it', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));

    expect(await dodoClient.cancelSubscription('sub_1')).toEqual({
      ok: false,
      statusCode: 0,
      message: 'CANCEL_UNREACHABLE',
    });
  });
});
