import { describe, expect, it } from 'vitest';

import {
  RespondToRatingSchema,
  SubmitRatingSchema,
} from '@/features/rating/validations/rating.validation';

const PROCEDURE = '507f1f77bcf86cd799439033';

const base = { procedureId: PROCEDURE, doctorScore: 4, clinicScore: 5 };

describe('SubmitRatingSchema', () => {
  it('accepts the two headline scores alone', () => {
    const result = SubmitRatingSchema.safeParse(base);

    expect(result.success).toBe(true);
    // The common case: a patient gives two numbers and leaves.
    expect(result.success && result.data.comment).toBe('');
    expect(result.success && result.data.subscores).toEqual({});
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

  it('accepts a partial set of subscores', () => {
    const result = SubmitRatingSchema.safeParse({ ...base, subscores: { cleanliness: 3 } });

    expect(result.success).toBe(true);
  });

  it('trims the comment, so whitespace is not stored as a review', () => {
    const result = SubmitRatingSchema.safeParse({ ...base, comment: '  fine  ' });

    expect(result.success && result.data.comment).toBe('fine');
  });

  it('rejects a comment past the 2000-character limit', () => {
    expect(SubmitRatingSchema.safeParse({ ...base, comment: 'x'.repeat(2001) }).success).toBe(false);
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
