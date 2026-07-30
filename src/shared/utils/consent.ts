import { z } from 'zod';

/**
 * A consent box that has to be ticked before the request is accepted.
 *
 * `z.boolean()` with no `.default()` on purpose. A default would let a caller omit the field
 * entirely and still pass, which turns a mandatory consent into an optional one for anything
 * that is not the browser form — the exact case the checkbox exists to prevent. Absent is as
 * invalid as false.
 *
 * The message is a bare code; the UI translates it, since a clinic reads this in Georgian.
 */
export const requiredConsent = () =>
  z.boolean().refine(value => value === true, { message: 'CONSENT_REQUIRED' });

/**
 * What gets written next to a set of accepted consents.
 *
 * Recorded server-side from the clock, never from the request: a timestamp the client can set is
 * not evidence of anything.
 */
export type ConsentRecord = {
  version: string;
  acceptedAt: Date;
};
