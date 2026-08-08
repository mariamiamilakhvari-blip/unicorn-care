/**
 * Domains a patient address is most often meant to be, and the misspellings seen in practice.
 *
 * A short, explicit list rather than an edit-distance search over every known provider. A generic
 * "did you mean" is confidently wrong on the long tail — a clinic's own domain, a small national
 * provider — and a wrong suggestion in a medical record is worse than no suggestion, because a
 * clinic in a hurry accepts it.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmail.co': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

/**
 * A likely correction for an address, or `null` when there is nothing confident to say.
 *
 * Returns a suggestion and never a replacement. The caller shows it and the clinic decides:
 * silently rewriting what someone typed into a patient record is how a reminder carrying a
 * patient's medication ends up in a stranger's inbox, and the clinic would never know it had
 * happened.
 */
export function suggestEmailCorrection(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();

  const corrected = DOMAIN_TYPOS[domain];
  if (!corrected) return null;

  return `${local}@${corrected}`;
}
