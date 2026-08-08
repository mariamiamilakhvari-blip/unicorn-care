import { createHmac, timingSafeEqual } from 'node:crypto';

/** How far out of date a signed request may be before it is refused, in seconds. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, so the length check has to come first.
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Svix-signed webhook body.
 *
 * Both providers this codebase receives from — Dodo Payments and Resend — sign with Svix, so the
 * scheme is here rather than copied into each client. A second hand-rolled HMAC comparison is a
 * second place for a timing leak or an off-by-one in the tolerance window to live.
 *
 * The timestamp check is what stops a replay: a captured request stays validly signed forever, so
 * age is the only thing that makes it stale. `Math.abs` covers clock skew in both directions —
 * a receiver running slow must not accept an hour-old request either.
 *
 * The body must be the exact bytes received. Parsing and re-serialising changes them and breaks
 * verification, which is why callers read `req.text()` before `JSON.parse`.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | undefined
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const sentAt = Number(headers.timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > SIGNATURE_TOLERANCE_SECONDS) return false;

  // Secrets are issued base64 behind a `whsec_` prefix.
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8');

  const expected = createHmac('sha256', key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest('base64');

  // The header carries a space-separated list of `v1,<signature>` entries.
  return headers.signature
    .split(' ')
    .map(part => part.split(',')[1] ?? '')
    .some(candidate => constantTimeEquals(candidate, expected));
}
