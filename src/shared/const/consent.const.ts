/**
 * The version of the consent wording currently in force.
 *
 * Stored alongside every acceptance, because "they ticked the box" is not a defensible record on
 * its own — the Law of Georgia on Personal Data Protection puts the burden of proof on the
 * controller, who has to be able to demonstrate *what* was agreed to. Without a version, rewording
 * a checkbox silently rewrites the history of every clinic that already accepted the old text.
 *
 * Bump this whenever any consent string in `messages/*.json` changes meaning. A typo fix does not
 * count; a change to what the clinic is agreeing to does.
 */
export const CONSENT_VERSION = '2026-07-30';

/**
 * The version of the Data Processing Agreement currently in force.
 *
 * Versioned apart from `CONSENT_VERSION` because it is a different document on a different clock:
 * the DPA is a contract the clinic executes, and a clinic asked later what it signed needs the
 * version of *that* text, not of the checkbox wording that happened to ship beside it. Bump it
 * whenever the substance of `legal-dpa.const.ts` changes.
 *
 * Required of every clinic, with no country rule. Under the Law of Georgia on Personal Data
 * Protection the clinic is the controller and this platform is the processor acting on its
 * instructions, and that relationship has to be governed by a written agreement — which is true of
 * every clinic using the platform, not of some subset of them.
 */
export const DPA_VERSION = '2026-08-16';
