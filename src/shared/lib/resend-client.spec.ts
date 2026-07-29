import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resendClient } from './resend-client';

const MESSAGE = {
  to: 'patient@example.com',
  subject: 'Your recovery plan',
  html: '<p>hello</p>',
  text: 'hello',
};

describe('resendClient', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('RESEND_FROM', 'Unicorn Care <care@example.com>');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('posts the message to Resend with the configured sender', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));

    const result = await resendClient.send(MESSAGE);

    expect(result).toEqual({ ok: true, id: 'email-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: 'Unicorn Care <care@example.com>',
      to: ['patient@example.com'],
      subject: 'Your recovery plan',
    });
  });

  /**
   * The live failure mode for an account with no verified domain. The reason has to survive to the
   * caller — "send failed" alone would send someone hunting through application code for a problem
   * that is entirely in the Resend dashboard.
   */
  it('surfaces the 403 domain restriction with its message intact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'You can only send testing emails to your own email address' }),
        { status: 403 }
      )
    );

    const result = await resendClient.send(MESSAGE);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a failure');
    expect(result.statusCode).toBe(403);
    expect(result.message).toContain('your own email address');
  });

  it('reports a missing key instead of sending, so a cron sweep keeps running', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await resendClient.send(MESSAGE);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, statusCode: 0, message: 'RESEND_NOT_CONFIGURED' });
    expect(resendClient.isConfigured()).toBe(false);
  });

  it('turns a network throw into a result rather than propagating it', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('socket hang up'));

    const result = await resendClient.send(MESSAGE);

    expect(result).toEqual({ ok: false, statusCode: 0, message: 'socket hang up' });
  });

  it('does not crash when Resend answers with a non-JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('gateway timeout', { status: 504 }));

    const result = await resendClient.send(MESSAGE);

    expect(result).toEqual({ ok: false, statusCode: 504, message: 'SEND_FAILED' });
  });
});
