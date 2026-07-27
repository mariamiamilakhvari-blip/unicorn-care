import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { rateLimit, RateLimiter } from '@/shared/lib/rate-limit';

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
    limiter.reset('k');
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

describe('rateLimit singleton', () => {
  it('is a RateLimiter instance', () => {
    expect(rateLimit).toBeInstanceOf(RateLimiter);
  });

  it('works without configuration', async () => {
    expect(await rateLimit.check(`spec:${Date.now()}`, 1, 1000)).toBe(true);
  });
});
