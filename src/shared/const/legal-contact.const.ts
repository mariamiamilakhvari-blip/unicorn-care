/**
 * Values both legal documents need.
 *
 * A leaf on purpose: this file imports nothing. They used to live in `legal.const.ts`, which
 * imports the document bodies, while the privacy body imports the contact address back out of it
 * — a cycle that left `LEGAL_CONTACT_EMAIL` in the temporal dead zone. The production bundler
 * happened to order the modules so it worked; the dev server did not, and both pages 500'd with
 * "Cannot access 'LEGAL_CONTACT_EMAIL' before initialization". Keeping the shared values below
 * every document removes the cycle rather than relying on evaluation order.
 */

/** Displayed on both pages. Move it whenever the substance of either document changes. */
export const LEGAL_LAST_UPDATED = '2026-07-30';

/** Where a data subject or a clinic writes to. Change this and both pages follow. */
export const LEGAL_CONTACT_EMAIL = 'privacy@unicorn.care';
