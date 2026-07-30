/**
 * The version of the consent wording currently in force.
 *
 * Stored alongside every acceptance, because "they ticked the box" is not a defensible record on
 * its own — GDPR Art. 7(1) asks the controller to demonstrate *what* was agreed to. Without a
 * version, rewording a checkbox silently rewrites the history of every clinic that already
 * accepted the old text.
 *
 * Bump this whenever any consent string in `messages/*.json` changes meaning. A typo fix does not
 * count; a change to what the clinic is agreeing to does.
 */
export const CONSENT_VERSION = '2026-07-30';
