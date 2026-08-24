import { SITE_URL } from '@/shared/const/seo.const';

/**
 * A loopback address in any of the spellings a `.env` file uses for one.
 *
 * Matched on the host rather than the whole string so a port, a path or a trailing slash does not
 * let one through — `http://localhost:3001/` and `http://127.0.0.1:3000` are the same mistake.
 */
const LOOPBACK_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#]|$)/i;

export function isLoopbackOrigin(origin: string): boolean {
  return LOOPBACK_HOST.test(origin.trim());
}

/**
 * The origin every emailed link is built on.
 *
 * `NEXTAUTH_URL` is the source, because it is the origin the auth system already resolves
 * callbacks against and a second variable would be a second thing to get wrong. `SITE_URL` is the
 * fallback: interpolating the bare variable produced `undefined/p/<token>` on any deployment that
 * had not set it.
 *
 * **A loopback origin is ignored outside development.** This is the whole reason the helper exists
 * rather than the one-line `||` it replaces. A production `NEXTAUTH_URL` left pointing at
 * `http://localhost:3001` is not a preference the code should honour — it mints a link that cannot
 * resolve anywhere except the machine that generated it, and the failure surfaces days later in a
 * patient's inbox as a connection error, on the one message that exists to let them in. The
 * deployment's own public origin is the only defensible answer there.
 *
 * In development the loopback value is exactly right and is used as given, so a link minted
 * locally still opens the local app.
 *
 * The trailing slash is stripped because the route constants all begin with one, and
 * `https://host//p/login/<token>` is a 404 on some hosts and a redirect on others.
 */
export function linkOrigin(): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured) return SITE_URL;

  if (isLoopbackOrigin(configured) && process.env.NODE_ENV !== 'development') return SITE_URL;

  return configured.replace(/\/+$/, '');
}
