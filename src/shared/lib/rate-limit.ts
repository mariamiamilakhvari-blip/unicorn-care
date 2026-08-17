import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const PRUNE_INTERVAL_MS = 60 * 1000;

/**
 * Namespace for every key this app writes, so a shared Upstash database is not a shared keyspace.
 * Upstash's own default prefix is generic enough that two projects on one database would throttle
 * each other.
 */
const REDIS_PREFIX = 'unicorn-care:ratelimit';

/**
 * Sliding-window rate limiter, backed by Upstash Redis when it is configured and by an in-process
 * map when it is not (PRD 02 §"Rate limiting").
 *
 * ## Why there are two backends rather than one
 *
 * The counters have to be shared across instances to mean anything: on Fluid Compute each instance
 * kept its own map, so a documented limit of 20/min was really 20/min *per instance* and scaled up
 * with traffic — the opposite of what a limiter is for.
 *
 * The in-memory path is not a legacy leftover. It is what runs in local development and in CI,
 * where `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are absent, and it is the fallback
 * when a Redis call fails. Requiring Redis would mean no developer could sign a clinic up offline,
 * and an Upstash outage would take every throttled route down with it.
 *
 * ## Behaviour when Redis is unreachable
 *
 * Degrade to the local map rather than failing open or closed. Failing open removes the throttle
 * from password reset and portal login during exactly the outage an attacker might have caused;
 * failing closed locks every legitimate user out of those same routes. Per-instance throttling is
 * weaker than shared, and it is much stronger than none.
 *
 * ## Scope
 *
 * This is the singleton behind every throttled route — company lookup, password reset and submit,
 * portal link request and redemption. They all become shared-state throttles together, because
 * they all call `check()` and none of them names a backend.
 */
class RateLimiter {
  private hits = new Map<string, number[]>();
  private lastPruneAt = 0;
  /** One `Ratelimit` per distinct limit/window pair — the tokens and window are baked into it. */
  private limiters = new Map<string, Ratelimit>();
  /** `undefined` = not yet resolved, `null` = resolved and not configured. Resolved once. */
  private redis?: Redis | null;

  /**
   * The Redis client, or null when this environment has no Upstash credentials.
   *
   * Constructed from explicit values rather than `Redis.fromEnv()`, which throws when the variables
   * are missing — and missing is the normal case in development, not an error worth an exception.
   */
  private client(): Redis | null {
    if (this.redis !== undefined) return this.redis;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.warnIfMisconfigured(Boolean(url), Boolean(token));
    this.redis = url && token ? new Redis({ url, token }) : null;

    return this.redis;
  }

  /**
   * Says out loud that the counters are per-instance, in the two cases where that is not intended.
   *
   * The fallback is deliberately silent in normal use — it is the correct behaviour in development
   * and CI — and that is exactly what makes a misconfiguration invisible: a half-set pair and a
   * fully working Upstash look identical from the outside, since both simply serve traffic. The
   * only symptom is a limit that is quietly multiplied by the instance count.
   *
   * Runs once per limiter, on the first check, because `client()` caches its result.
   */
  private warnIfMisconfigured(hasUrl: boolean, hasToken: boolean): void {
    if (hasUrl !== hasToken) {
      const missing = hasUrl ? 'UPSTASH_REDIS_REST_TOKEN' : 'UPSTASH_REDIS_REST_URL';
      console.warn(
        `[rate-limit] ${missing} is not set while its pair is — Upstash needs both. ` +
          'Falling back to per-instance counters, so the configured limit is multiplied by the ' +
          'number of running instances.'
      );
      return;
    }

    /*
      Not a warning in development or CI, where running without Upstash is the intended path and a
      warning on every boot would train everyone to ignore this line.
    */
    if (!hasUrl && process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are both unset in ' +
          'production — rate limit counters are per-instance and the effective limit scales with ' +
          'the number of running instances.'
      );
    }
  }

  /** Cached per limit/window, because constructing one per request would leak a client each time. */
  private forWindow(redis: Redis, limit: number, windowMs: number): Ratelimit {
    const id = `${limit}:${windowMs}`;
    const existing = this.limiters.get(id);
    if (existing) return existing;

    const created = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: REDIS_PREFIX,
      // Off deliberately: it costs an extra round trip per call and writes a second key per window.
      analytics: false,
    });
    this.limiters.set(id, created);

    return created;
  }

  /** Returns true when the call is allowed, false when the key has exhausted its window. */
  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    /*
      Answered before either backend. A zero limit means "never allow", which is a coherent thing
      to configure, but `slidingWindow(0, …)` is not — it divides by the token count.
    */
    if (limit <= 0) return false;

    const redis = this.client();
    if (redis) {
      try {
        const { success } = await this.forWindow(redis, limit, windowMs).limit(key);
        return success;
      } catch {
        // Fall through to the local window. See "Behaviour when Redis is unreachable" above.
      }
    }

    return this.checkLocal(key, limit, windowMs);
  }

  /** The in-process sliding window: the fallback backend, and the only one in dev and CI. */
  private checkLocal(key: string, limit: number, windowMs: number): boolean {
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

  /**
   * Drops a key's window early, e.g. after a successful redemption.
   *
   * Clears both backends, and always clears the local map first so a Redis failure cannot leave a
   * user throttled locally after the credential they were being throttled on turned out to be
   * valid. Awaited by its callers rather than fired and forgotten: this runs on the success path of
   * a login, and silently failing to clear the window would throttle someone who just proved they
   * should not be.
   */
  async reset(key: string): Promise<void> {
    this.hits.delete(key);

    const redis = this.client();
    if (!redis) return;

    try {
      /*
        Every cached window, because the key alone does not say which limit/window it was counted
        under. A key that has never been checked in this process has no cached window and nothing
        to clear — which is harmless, since `reset` is only ever called just after a `check` on the
        same key.
      */
      await Promise.all(
        [...this.limiters.values()].map(limiter => limiter.resetUsedTokens(key))
      );
    } catch {
      // Best effort. The window expires on its own, and the local map is already cleared.
    }
  }

  /** Number of keys held in the local map — exposed so the prune sweep is observable. */
  size(): number {
    return this.hits.size;
  }

  /** Sweeps every local key so abandoned ones cannot grow the map without bound. */
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
