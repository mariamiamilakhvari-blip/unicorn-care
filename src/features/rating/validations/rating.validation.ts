import { z } from 'zod';

/** The scale, in one place — the headline scores and the subscores share it. */
const Score = z.coerce.number().int().min(1).max(5);

/**
 * `POST /api/patient-portal/ratings`.
 *
 * Both headline scores are required and every subscore is optional: a patient who wants to give a
 * number and leave is the common case, and a form that demands six answers gets fewer of all six.
 */
export const SubmitRatingSchema = z.object({
  procedureId: z.string().min(24).max(24),
  doctorScore: Score,
  clinicScore: Score,
  subscores: z
    .object({
      communication: Score.nullish(),
      cleanliness: Score.nullish(),
      painManagement: Score.nullish(),
      resultSatisfaction: Score.nullish(),
    })
    .default({}),
  comment: z.string().trim().max(2000).default(''),
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
