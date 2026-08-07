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

/**
 * The version of the Business Associate Agreement currently in force.
 *
 * Versioned apart from `CONSENT_VERSION` because it is a different document on a different clock:
 * the BAA is a contract a US clinic executes, and a clinic asked later what it signed needs the
 * version of *that* text, not of the checkbox wording that happened to ship beside it. Bump it
 * whenever the substance of `legal-baa.const.ts` changes.
 */
export const BAA_VERSION = '2026-08-07';

/**
 * The one country whose law makes the BAA mandatory.
 *
 * HIPAA binds US Covered Entities. A clinic outside the US is not a party to a BAA and forcing
 * one on it produces a signature that means nothing — so the box is offered everywhere and
 * required here. Resolved through `toCountryCode`, so "United States", "US" and "us" all match.
 */
export const BAA_REQUIRED_COUNTRY = 'US';
