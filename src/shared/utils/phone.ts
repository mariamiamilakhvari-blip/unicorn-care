/**
 * The digits of a phone number, as a `wa.me` link needs them.
 *
 * WhatsApp accepts a bare international number and nothing else: no `+`, no spaces, no dashes,
 * no leading `00`. Anything it cannot parse lands the clinician on an error page rather than a
 * chat, which on a symptom queue is a call that did not happen.
 *
 * Returns an empty string when the result could not be a real international number, and callers
 * are expected to render plain text rather than a link in that case — the same rule the `tel:`
 * link in the report queue already follows, for the same reason: a dead link is worse than none.
 *
 * **This cannot detect a missing country code**, and that is the honest limit of it. `599123456`
 * is a valid-looking ten digits and a Georgian mobile written the local way, and `wa.me` would
 * read it as a number in some other country entirely. The portal field asks for the international
 * form and says so; a clinic staring at a number with no country code has to read it, which is
 * why the number is always printed next to the link rather than hidden behind it.
 */
const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // `00` is the other way of writing `+`, and WhatsApp understands neither.
  const trimmed = digits.startsWith('00') ? digits.slice(2) : digits;

  if (trimmed.length < MIN_E164_DIGITS || trimmed.length > MAX_E164_DIGITS) return '';
  return trimmed;
}

/** The chat URL, or an empty string when the number is not one WhatsApp could open. */
export function whatsAppLink(phone: string): string {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}` : '';
}

/**
 * The `tel:` form. Spaces break the dialler on some Android builds; the `+` must survive, because
 * dropping it turns an international number into a local one and dials the wrong country.
 */
export function toDialNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
