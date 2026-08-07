/** What is recorded when no header carries an address — never an empty string, which reads as unset. */
export const UNKNOWN_IP = 'unknown';

/**
 * The client's address, as far as the platform can honestly tell.
 *
 * Behind Vercel's proxy `x-forwarded-for` is a comma-separated chain and the first entry is the
 * original client; `x-real-ip` is the fallback for proxies that only set that. Nothing here is
 * proof of identity — a header can be forged by anyone talking to the origin directly — which is
 * why it is written next to a consent as supporting evidence and never used to authorise
 * anything.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  return headers.get('x-real-ip')?.trim() || UNKNOWN_IP;
}
