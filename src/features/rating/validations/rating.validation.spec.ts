import { describe, expect, it } from 'vitest';

import {
  RespondToRatingSchema,
  SubmitRatingSchema,
} from '@/features/rating/validations/rating.validation';

const PROCEDURE = '507f1f77bcf86cd799439033';

const base = { procedureId: PROCEDURE, doctorScore: 4, clinicScore: 5 };

describe('SubmitRatingSchema', () => {
  it('accepts the two star ratings, which are the whole form', () => {
    const result = SubmitRatingSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(base);
  });

  it.each([
    ['zero', 0],
    ['six', 6],
    ['a fraction', 3.5],
  ])('rejects a score of %s', (_label, doctorScore) => {
    expect(SubmitRatingSchema.safeParse({ ...base, doctorScore }).success).toBe(false);
  });

  it.each([1, 5])('accepts both ends of the scale (%i)', score => {
    expect(
      SubmitRatingSchema.safeParse({ ...base, doctorScore: score, clinicScore: score }).success
    ).toBe(true);
  });

  it('requires both headline scores', () => {
    expect(SubmitRatingSchema.safeParse({ procedureId: PROCEDURE, doctorScore: 4 }).success).toBe(
      false
    );
  });

  /*
    The detail scores and the free-text comment are no longer collected, so the API no longer takes
    them. Stripped rather than rejected: Zod drops unknown keys by default, and a portal left open
    in a tab across the deploy still submits the old shape — failing that request would cost the
    patient their rating over two fields nobody reads any more.
  */
  describe('the withdrawn fields', () => {
    it.each([
      ['a comment', { comment: 'a paragraph nobody asked for' }],
      ['subscores', { subscores: { cleanliness: 3 } }],
      ['both', { comment: 'text', subscores: { communication: 5 } }],
    ])('accepts a stale submission carrying %s, and keeps neither', (_case, extra) => {
      const result = SubmitRatingSchema.safeParse({ ...base, ...extra });

      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual(base);
    });
  });

  it('rejects an id that is not an ObjectId', () => {
    expect(SubmitRatingSchema.safeParse({ ...base, procedureId: 'abc' }).success).toBe(false);
  });
});

describe('RespondToRatingSchema', () => {
  it('rejects an empty reply', () => {
    // An empty response would render as a blank clinic reply beside the patient's words.
    expect(RespondToRatingSchema.safeParse({ response: '   ' }).success).toBe(false);
  });

  it('accepts a real one', () => {
    expect(RespondToRatingSchema.safeParse({ response: 'Thank you' }).success).toBe(true);
  });
});
