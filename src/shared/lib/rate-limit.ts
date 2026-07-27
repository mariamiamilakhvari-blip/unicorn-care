const PRUNE_INTERVAL_MS = 60 * 1000;

/**
 * In-memory sliding-window rate limiter (PRD 02 §"Rate limiting").
 *
 * NOTE: state lives in this process only. On a multi-instance / serverless deployment each
 * instance keeps its own counters, so the effective limit is `limit x instances`. Before scaling
 * past a single instance, move the window to a shared store (Redis / Upstash) behind this exact
 * `check()` signature — nothing else has to change.
 */
class RateLimiter {
  private hits = new Map<string, number[]>();
  private lastPruneAt = 0;

  /** Returns true when the call is allowed, false when the key has exhausted its window. */
  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    this.pruneExpired(now, windowMs);

    const cutoff = now - windowMs;
    const recent = (this.hits.get(key) ?? []).filter(timestamp => timestamp > cutoff);

    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drops a key's window early, e.g. after a successful redemption. */
  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Number of keys currently held — exposed so the prune sweep is observable. */
  size(): number {
    return this.hits.size;
  }

  /** Sweeps every key so abandoned ones cannot grow the map without bound. */
  private pruneExpired(now: number, windowMs: number): void {
    if (now - this.lastPruneAt < PRUNE_INTERVAL_MS) return;
    this.lastPruneAt = now;

    const cutoff = now - windowMs;
    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter(timestamp => timestamp > cutoff);
      this.replaceOrDelete(key, recent);
    }
  }

  private replaceOrDelete(key: string, recent: number[]): void {
    if (recent.length === 0) {
      this.hits.delete(key);
      return;
    }
    this.hits.set(key, recent);
  }
}

export const rateLimit = new RateLimiter();
export { RateLimiter };
