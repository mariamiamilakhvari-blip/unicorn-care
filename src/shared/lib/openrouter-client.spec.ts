import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { openRouterClient, OpenRouterClient } from '@/shared/lib/openrouter-client';

const MESSAGES = [
  { role: 'system' as const, content: 'You are a post-op care assistant.' },
  { role: 'user' as const, content: 'When do I take my next dose?' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
  process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenRouterClient.chat — success', () => {
  it('returns the assistant message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '  Your next dose is at 20:00.  ' } }] })
      )
    );

    const result = await new OpenRouterClient().chat(MESSAGES);

    expect(result).toEqual({ ok: true, content: 'Your next dose is at 20:00.' });
  });

  it('sends the configured model, the messages, and a bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await new OpenRouterClient().chat(MESSAGES);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.test/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('openai/gpt-oss-20b:free');
    expect(body.messages).toEqual(MESSAGES);
    // Low temperature is a safety property here, not a style choice.
    expect(body.temperature).toBeLessThanOrEqual(0.3);
  });

  it('excludes reasoning tokens so a reasoning model still returns content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await new OpenRouterClient().chat(MESSAGES);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ effort: 'low', exclude: true });
  });
});

describe('OpenRouterClient.chat — failures never throw', () => {
  it('reports unauthorized when the API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenRouterClient().chat(MESSAGES);

    expect(result).toEqual({ ok: false, statusCode: 0, reason: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 401 to unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    expect(await new OpenRouterClient().chat(MESSAGES)).toEqual({
      ok: false,
      statusCode: 401,
      reason: 'unauthorized',
    });
  });

  it('maps 429 to rate_limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));
    expect(await new OpenRouterClient().chat(MESSAGES)).toEqual({
      ok: false,
      statusCode: 429,
      reason: 'rate_limited',
    });
  });

  it('maps 500 to upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect(await new OpenRouterClient().chat(MESSAGES)).toEqual({
      ok: false,
      statusCode: 500,
      reason: 'upstream',
    });
  });

  it('treats an empty choices array as an upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ choices: [] })));
    const result = await new OpenRouterClient().chat(MESSAGES);
    expect(result).toEqual({ ok: false, statusCode: 200, reason: 'upstream' });
  });

  // What a reasoning model returns when it exhausts the budget before writing an answer.
  it('treats a null content with finish_reason length as an upstream failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: null }, finish_reason: 'length' }] })
      )
    );
    const result = await new OpenRouterClient().chat(MESSAGES);
    expect(result).toEqual({ ok: false, statusCode: 200, reason: 'upstream' });
  });

  it('swallows a network rejection instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));
    await expect(new OpenRouterClient().chat(MESSAGES)).resolves.toEqual({
      ok: false,
      statusCode: 0,
      reason: 'upstream',
    });
  });
});

describe('openRouterClient singleton', () => {
  it('is an OpenRouterClient instance', () => {
    expect(openRouterClient).toBeInstanceOf(OpenRouterClient);
  });
});
