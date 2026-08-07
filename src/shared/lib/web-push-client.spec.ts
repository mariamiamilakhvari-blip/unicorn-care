/* eslint-disable import/order -- vi.mock is hoisted above imports, so the mock must be declared first. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The factory is hoisted above every top-level statement, so the fake error class must be
// declared inside it — a module-scope class would not be initialised yet when it runs.
vi.mock('web-push', () => {
  class FakeWebPushError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number
    ) {
      super(message);
    }
  }

  return {
    sendNotification: vi.fn(),
    setVapidDetails: vi.fn(),
    WebPushError: FakeWebPushError,
  };
});

import { sendNotification, setVapidDetails, WebPushError } from 'web-push';

import { webPushClient, WebPushClient } from '@/shared/lib/web-push-client';

const mockSend = vi.mocked(sendNotification);
const mockSetVapid = vi.mocked(setVapidDetails);

const SUB = { endpoint: 'https://push.example/abc', p256dh: 'p256dh-key', auth: 'auth-key' };

/** Builds the error `web-push` rejects with, so the mock matches the real `instanceof` check. */
function pushError(message: string, statusCode: number): WebPushError {
  return new WebPushError(message, statusCode, {}, message, SUB.endpoint);
}

const PAYLOAD = {
  title: 'Amoxicillin — 500 mg',
  body: 'Take with food. 08:00',
  url: '/p',
  occurrenceId: '507f1f77bcf86cd799439066',
  tag: '507f1f77bcf86cd799439066',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_SUBJECT = 'mailto:ops@unicorn.care';
  process.env.VAPID_PUBLIC_KEY = 'public-key';
  process.env.VAPID_PRIVATE_KEY = 'private-key';
});

describe('WebPushClient.send — success', () => {
  it('returns ok and forwards the encrypted subscription shape', async () => {
    mockSend.mockResolvedValueOnce({ statusCode: 201 } as never);
    const client = new WebPushClient();
    const result = await client.send(SUB, PAYLOAD);

    expect(result).toEqual({ ok: true });
    expect(mockSend).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, keys: { p256dh: SUB.p256dh, auth: SUB.auth } },
      JSON.stringify(PAYLOAD),
      // An endpoint that accepts a connection then goes quiet would otherwise hold the whole
      // sequential sweep open behind it.
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });

  it('serialises the payload so the service worker can read title/body/url/tag', async () => {
    mockSend.mockResolvedValueOnce({ statusCode: 201 } as never);
    await new WebPushClient().send(SUB, PAYLOAD);
    const body = JSON.parse(mockSend.mock.calls[0][1] as string);
    expect(body).toEqual(PAYLOAD);
  });
});

describe('WebPushClient — lazy VAPID configuration', () => {
  it('calls setVapidDetails from env on the first send', async () => {
    mockSend.mockResolvedValue({ statusCode: 201 } as never);
    const client = new WebPushClient();
    await client.send(SUB, PAYLOAD);
    expect(mockSetVapid).toHaveBeenCalledWith('mailto:ops@unicorn.care', 'public-key', 'private-key');
  });

  it('configures only once across repeated sends', async () => {
    mockSend.mockResolvedValue({ statusCode: 201 } as never);
    const client = new WebPushClient();
    await client.send(SUB, PAYLOAD);
    await client.send(SUB, PAYLOAD);
    await client.send(SUB, PAYLOAD);
    expect(mockSetVapid).toHaveBeenCalledTimes(1);
  });

  it('does not configure at import time', () => {
    expect(mockSetVapid).not.toHaveBeenCalled();
  });

  it('returns a failure shape instead of throwing when setVapidDetails throws', async () => {
    mockSetVapid.mockImplementationOnce(() => {
      throw new Error('Vapid subject is not a url or mailto url');
    });
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 0, gone: false });
  });
});

describe('WebPushClient.send — failures', () => {
  it('marks gone on 410', async () => {
    mockSend.mockRejectedValueOnce(pushError('gone', 410));
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 410, gone: true });
  });

  it('marks gone on 404', async () => {
    mockSend.mockRejectedValueOnce(pushError('not found', 404));
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 404, gone: true });
  });

  it('does not mark gone on 429', async () => {
    mockSend.mockRejectedValueOnce(pushError('too many requests', 429));
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 429, gone: false });
  });

  it('does not mark gone on 500', async () => {
    mockSend.mockRejectedValueOnce(pushError('server error', 500));
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 500, gone: false });
  });

  it('reports statusCode 0 for a non-WebPushError rejection', async () => {
    mockSend.mockRejectedValueOnce(new Error('socket hang up'));
    const result = await new WebPushClient().send(SUB, PAYLOAD);
    expect(result).toEqual({ ok: false, statusCode: 0, gone: false });
  });

  it('never throws', async () => {
    mockSend.mockRejectedValueOnce(pushError('gone', 410));
    await expect(new WebPushClient().send(SUB, PAYLOAD)).resolves.toBeDefined();
  });
});

describe('webPushClient singleton', () => {
  it('is a WebPushClient instance', () => {
    expect(webPushClient).toBeInstanceOf(WebPushClient);
  });
});
