import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { rateLimit, RateLimiter } from '@/shared/lib/rate-limit';

/*
  Hoisted so the `vi.mock` factories below — which are lifted above the imports — can close over
  them. Declaring them as plain consts would leave the factories reading a variable in its TDZ.
*/
const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  resetUsedTokens: vi.fn(),
  slidingWindow: vi.fn(),
  redisCtor: vi.fn(),
  ratelimitCtor: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(config: { url: string; token: string }) {
      mocks.redisCtor(config);
    }
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class MockRatelimit {
    limit = mocks.limit;
    resetUsedTokens = mocks.resetUsedTokens;
    static slidingWindow = mocks.slidingWindow;
    constructor(config: { prefix: string; analytics: boolean }) {
      mocks.ratelimitCtor(config);
    }
  },
}));

const withUpstash = () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue({ success: true });
  mocks.resetUsedTokens.mockResolvedValue(undefined);
  mocks.slidingWindow.mockReturnValue('sliding-window');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('RateLimiter.check', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows calls up to the limit', async () => {
    const limiter = new RateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(await limiter.check('ip:1.2.3.4', 10, 600000)).toBe(true);
    }
  });

  it('blocks the call that exceeds the limit', async () => {
    const limiter = new RateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await limiter.check('ip:1.2.3.4', 10, 600000);
    }
    expect(await limiter.check('ip:1.2.3.4', 10, 600000)).toBe(false);
  });

  it('keeps blocking while the window is still full', async () => {
    const limiter = new RateLimiter();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await limiter.check('k', 2, 600000);
    }
    expect(await limiter.check('k', 2, 600000)).toBe(false);
  });

  it('tracks keys independently', async () => {
    const limiter = new RateLimiter();
    await limiter.check('a', 1, 600000);
    expect(await limiter.check('a', 1, 600000)).toBe(false);
    expect(await limiter.check('b', 1, 600000)).toBe(true);
  });

  it('slides — allows again once the window has passed', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const limiter = new RateLimiter();
    await limiter.check('k', 1, 600000);
    expect(await limiter.check('k', 1, 600000)).toBe(false);

    vi.setSystemTime(new Date('2025-01-01T00:10:01Z'));
    expect(await limiter.check('k', 1, 600000)).toBe(true);
  });

  it('slides partially — old hits expire one at a time', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const limiter = new RateLimiter();
    await limiter.check('k', 2, 10000);

    vi.setSystemTime(new Date('2025-01-01T00:00:06Z'));
    await limiter.check('k', 2, 10000);
    expect(await limiter.check('k', 2, 10000)).toBe(false);

    // First hit is now outside the 10s window, the second is not.
    vi.setSystemTime(new Date('2025-01-01T00:00:11Z'));
    expect(await limiter.check('k', 2, 10000)).toBe(true);
    expect(await limiter.check('k', 2, 10000)).toBe(false);
  });

  it('does not blow up on a zero limit', async () => {
    const limiter = new RateLimiter();
    expect(await limiter.check('k', 0, 1000)).toBe(false);
  });
});

describe('RateLimiter.reset', () => {
  it('clears a key immediately', async () => {
    const limiter = new RateLimiter();
    await limiter.check('k', 1, 600000);
    expect(await limiter.check('k', 1, 600000)).toBe(false);
    await limiter.reset('k');
    expect(await limiter.check('k', 1, 600000)).toBe(true);
  });
});

describe('RateLimiter pruning', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drops abandoned keys so the map does not grow without bound', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const limiter = new RateLimiter();
    for (let index = 0; index < 50; index += 1) {
      await limiter.check(`ip:${index}`, 5, 60000);
    }

    // Past the window and past the prune interval — the sweep runs on the next check.
    vi.setSystemTime(new Date('2025-01-01T00:05:00Z'));
    await limiter.check('ip:fresh', 5, 60000);

    expect(limiter.size()).toBe(1);
    // The surviving key is the fresh one — it still has budget left.
    expect(await limiter.check('ip:fresh', 1, 60000)).toBe(false);
  });

  it('retains keys whose hits are still inside the window', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const limiter = new RateLimiter();
    await limiter.check('ip:1', 5, 600000);

    vi.setSystemTime(new Date('2025-01-01T00:02:00Z'));
    await limiter.check('ip:2', 5, 600000);

    expect(limiter.size()).toBe(2);
  });
});

describe('RateLimiter without Upstash configured', () => {
  /**
   * The path every developer and every CI run takes. It must not merely work — it must not touch
   * the Upstash client at all, since `Redis.fromEnv()`-style construction throws on missing
   * credentials and would turn a missing `.env` line into a 500 on the sign-up form.
   */
  it('never constructs a Redis client', async () => {
    const limiter = new RateLimiter();

    await limiter.check('k', 5, 60000);

    expect(mocks.redisCtor).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it('still throttles locally', async () => {
    const limiter = new RateLimiter();

    expect(await limiter.check('k', 1, 60000)).toBe(true);
    expect(await limiter.check('k', 1, 60000)).toBe(false);
  });

  it('resets without reaching for Redis', async () => {
    const limiter = new RateLimiter();
    await limiter.check('k', 1, 60000);

    await limiter.reset('k');

    expect(mocks.resetUsedTokens).not.toHaveBeenCalled();
    expect(await limiter.check('k', 1, 60000)).toBe(true);
  });
});

describe('RateLimiter with Upstash configured', () => {
  it('builds the client from the environment credentials', async () => {
    withUpstash();
    const limiter = new RateLimiter();

    await limiter.check('k', 5, 60000);

    expect(mocks.redisCtor).toHaveBeenCalledWith({
      url: 'https://example.upstash.io',
      token: 'test-token',
    });
  });

  it('delegates the decision to Upstash', async () => {
    withUpstash();
    mocks.limit.mockResolvedValue({ success: false });
    const limiter = new RateLimiter();

    expect(await limiter.check('company-lookup:1.2.3.4', 20, 60000)).toBe(false);
    expect(mocks.limit).toHaveBeenCalledWith('company-lookup:1.2.3.4');
  });

  /** The window is milliseconds internally and a Duration string to Upstash. `ms` is a valid unit. */
  it('passes the window through as a millisecond Duration', async () => {
    withUpstash();
    const limiter = new RateLimiter();

    await limiter.check('k', 20, 60000);

    expect(mocks.slidingWindow).toHaveBeenCalledWith(20, '60000 ms');
  });

  /** A shared Upstash database must not become a shared keyspace between projects. */
  it('namespaces its keys with a project prefix', async () => {
    withUpstash();
    const limiter = new RateLimiter();

    await limiter.check('k', 20, 60000);

    expect(mocks.ratelimitCtor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'unicorn-care:ratelimit', analytics: false })
    );
  });

  /**
   * One client and one limiter per distinct window, not per request. Building them per call would
   * allocate a fresh HTTP client on every lookup a clinic triggers while typing its tax ID.
   */
  it('reuses one limiter per limit/window pair', async () => {
    withUpstash();
    const limiter = new RateLimiter();

    await limiter.check('a', 20, 60000);
    await limiter.check('b', 20, 60000);
    await limiter.check('c', 5, 900000);

    expect(mocks.redisCtor).toHaveBeenCalledTimes(1);
    expect(mocks.ratelimitCtor).toHaveBeenCalledTimes(2);
  });

  /**
   * An Upstash outage must not remove the throttle from password reset and portal login — that is
   * the moment it matters most. Degrading to the local window is weaker than shared state and far
   * stronger than failing open.
   */
  it('falls back to the local window when Upstash throws', async () => {
    withUpstash();
    mocks.limit.mockRejectedValue(new Error('ECONNRESET'));
    const limiter = new RateLimiter();

    expect(await limiter.check('k', 1, 60000)).toBe(true);
    expect(await limiter.check('k', 1, 60000)).toBe(false);
  });

  it('clears the Upstash window on reset', async () => {
    withUpstash();
    const limiter = new RateLimiter();
    await limiter.check('k', 1, 60000);

    await limiter.reset('k');

    expect(mocks.resetUsedTokens).toHaveBeenCalledWith('k');
  });

  /**
   * Reset runs on the success path of a login. If Upstash refuses the clear, the local map must
   * still be cleared and the caller must not see an exception on an otherwise successful request.
   */
  it('survives a failed Upstash reset', async () => {
    withUpstash();
    mocks.resetUsedTokens.mockRejectedValue(new Error('ECONNRESET'));
    const limiter = new RateLimiter();
    await limiter.check('k', 1, 60000);

    await expect(limiter.reset('k')).resolves.toBeUndefined();
  });
});

describe('RateLimiter misconfiguration warning', () => {
  const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  it.each([
    ['the token', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    ['the url', 'UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REDIS_REST_URL'],
  ])('warns when %s is missing and falls back', async (_label, present, missing) => {
    const spy = warn();
    vi.stubEnv(present, 'set-value');
    const limiter = new RateLimiter();

    expect(await limiter.check('k', 1, 60000)).toBe(true);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain(missing);
    // Half-configured must never reach Upstash — the client would be constructed without a pair.
    expect(mocks.redisCtor).not.toHaveBeenCalled();
    // And it must still throttle, locally.
    expect(await limiter.check('k', 1, 60000)).toBe(false);
  });

  /** The silent-in-production case the warning exists for. */
  it('warns when neither is set in production', async () => {
    const spy = warn();
    vi.stubEnv('NODE_ENV', 'production');
    const limiter = new RateLimiter();

    await limiter.check('k', 1, 60000);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('per-instance');
  });

  /** Running without Upstash is the intended path here; a boot-time warning would be noise. */
  it('stays quiet when neither is set outside production', async () => {
    const spy = warn();
    const limiter = new RateLimiter();

    await limiter.check('k', 1, 60000);

    expect(spy).not.toHaveBeenCalled();
  });

  it('stays quiet when both are set', async () => {
    const spy = warn();
    withUpstash();
    const limiter = new RateLimiter();

    await limiter.check('k', 1, 60000);

    expect(spy).not.toHaveBeenCalled();
  });

  /** Once per limiter, not once per request — `client()` caches, and this rides on that. */
  it('warns only once across many checks', async () => {
    const spy = warn();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    const limiter = new RateLimiter();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.check(`k${attempt}`, 5, 60000);
    }

    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('rateLimit singleton', () => {
  it('is a RateLimiter instance', () => {
    expect(rateLimit).toBeInstanceOf(RateLimiter);
  });

  it('works without configuration', async () => {
    expect(await rateLimit.check(`spec:${Date.now()}`, 1, 1000)).toBe(true);
  });
});
