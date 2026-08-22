/**
 * How long a patient may revise a rating after filing it.
 *
 * A rating a patient can revise indefinitely is a rating a clinic can ask them to revise; a
 * rating that locks the instant it is submitted preserves a mis-tap on a five-point scale
 * forever. A day is long enough to reconsider and short enough that nobody is lobbied.
 */
export const RATING_EDIT_WINDOW_HOURS = 24;

/**
 * Below this many ratings, a clinic sees "not enough ratings yet" instead of an average.
 *
 * One unhappy patient is not a 2.0 clinic and one happy patient is not a 5.0 clinic. Showing
 * either number tells a clinic something untrue about itself and — once these become public —
 * tells a patient something untrue about where they are about to have surgery.
 *
 * TEMPORARY — lowered from 5 to 1 to review the public rating boards against the single rating in
 * the database. **Restore to 5 before this reaches patients.**
 *
 * At 1 the guarantee above is not merely weakened, it is gone: the public leaderboard on the
 * landing page will rank a clinic and a named surgeon on one patient's opinion, and the clinic's
 * own dashboard will show that opinion as its average. This constant governs both surfaces, so
 * there is no way to lower it for the board alone.
 */
export const MIN_RATINGS_FOR_AVERAGE = 1;

/** The optional detail scores, in the order the form asks for them. */
export const RATING_SUBSCORE_KEYS = [
  'communication',
  'cleanliness',
  'painManagement',
  'resultSatisfaction',
] as const;

export type RatingSubscoreKey = (typeof RATING_SUBSCORE_KEYS)[number];

/** The scale itself, for rendering the five buttons without an inline array. */
export const RATING_SCALE = [1, 2, 3, 4, 5] as const;
