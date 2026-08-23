/**
 * Normalises a name typed into a destructive-action confirmation box.
 *
 * Trims the ends and collapses every internal run of whitespace to a single space. Both halves
 * matter, and the second one is the reason this exists rather than a bare `.trim()`: nothing trims
 * `firstName`/`lastName` on the way into the database, so a record can hold `"tamar "` + `"amilakhvari"`
 * and produce the full name `"tamar  amilakhvari"` — two spaces. HTML collapses that run when it
 * renders, so the label, the placeholder and the list row all *look* like a single space. Somebody
 * types exactly what they see, the comparison fails on a character that was never visible, and the
 * confirm button stays disabled with nothing on screen to explain why.
 *
 * Case is deliberately left alone. Whitespace is a storage artefact; case is the difference between
 * reading the name and skimming past it, which is the whole point of typing it out.
 */
export function normalizeConfirmationName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** True when a typed confirmation matches the record's own name. */
export function confirmationMatches(typed: string, actual: string): boolean {
  return normalizeConfirmationName(typed) === normalizeConfirmationName(actual);
}
