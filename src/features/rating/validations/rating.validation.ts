import { z } from 'zod';

/** The scale, in one place — the headline scores and the subscores share it. */
const Score = z.coerce.number().int().min(1).max(5);

/**
 * `POST /api/patient-portal/ratings`.
 *
 * Two stars, and nothing else. The form used to carry four optional detail scores behind a fold
 * and a free-text box beneath them; a patient who wanted to give a number and leave was the common
 * case, and everything past the second question cost completions without adding signal.
 *
 * The stored document keeps its `subscores` and `comment` columns, so ratings filed before this
 * still read back in full for the clinic. Nothing new arrives in either, so neither is accepted
 * from the client — a field the form cannot produce is a field the API should not take.
 */
export const SubmitRatingSchema = z.object({
  procedureId: z.string().min(24).max(24),
  doctorScore: Score,
  clinicScore: Score,
});

export type SubmitRatingType = z.infer<typeof SubmitRatingSchema>;

/**
 * `PATCH /api/patient-portal/ratings/[id]` — the 24-hour correction window.
 *
 * The same fields, because a patient revising a rating is replacing it, not amending one field.
 * `procedureId` is absent: the rating already knows which procedure it belongs to, and accepting
 * it here would let a request move a rating onto a different procedure.
 */
export const ReviseRatingSchema = SubmitRatingSchema.omit({ procedureId: true });

export type ReviseRatingType = z.infer<typeof ReviseRatingSchema>;

/** `POST /api/ratings/[id]/response` — the clinic's reply. It may answer, never delete. */
export const RespondToRatingSchema = z.object({
  response: z.string().trim().min(1).max(2000),
});

export type RespondToRatingType = z.infer<typeof RespondToRatingSchema>;
