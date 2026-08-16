/**
 * Values the legal documents share.
 *
 * A leaf on purpose: this file imports nothing. They used to live in `legal.const.ts`, which
 * imports the document bodies, while the privacy body imports the contact address back out of it
 * — a cycle that left `LEGAL_CONTACT_EMAIL` in the temporal dead zone. The production bundler
 * happened to order the modules so it worked; the dev server did not, and both pages 500'd with
 * "Cannot access 'LEGAL_CONTACT_EMAIL' before initialization". Keeping the shared values below
 * every document removes the cycle rather than relying on evaluation order.
 */

/**
 * The date the Terms of Service and Privacy Policy were last revised. They were written together
 * and have moved together since, so they share one value.
 *
 * *Not* the date every legal page shows — each document carries its own `lastUpdated`, and the
 * DPA takes its date from `DPA_VERSION` instead. Move this when the substance of the Terms or the
 * Privacy Policy changes, and only those two follow.
 */
export const LEGAL_LAST_UPDATED = '2026-07-30';

/** Where a data subject or a clinic writes to. Change this and both pages follow. */
export const LEGAL_CONTACT_EMAIL = 'privacy@unicorn.care';
