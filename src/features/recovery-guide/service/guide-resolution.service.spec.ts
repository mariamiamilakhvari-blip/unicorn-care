import { describe, expect, it } from 'vitest';

import {
  resolveGuideBody,
  resolveGuideList,
} from '@/features/recovery-guide/service/guide-resolution.service';

const OWN = ['clinic a', 'clinic b'];
const DEFAULTS = ['platform a', 'platform b', 'platform c'];

describe('resolveGuideList', () => {
  /**
   * The bug this exists to close. A patient could not tell which lines their own surgeon had
   * written, because the platform's generic list sat underneath them.
   */
  it('returns the clinic list alone when the clinic wrote one', () => {
    expect(resolveGuideList(OWN, DEFAULTS)).toEqual(OWN);
  });

  it('falls back to the platform list when the clinic wrote none', () => {
    expect(resolveGuideList([], DEFAULTS)).toEqual(DEFAULTS);
  });

  it.each([
    ['the clinic list is undefined', undefined],
    ['the clinic list is empty', []],
  ])('falls back when %s', (_case, own) => {
    expect(resolveGuideList(own, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('returns nothing when neither side has anything', () => {
    expect(resolveGuideList([], [])).toEqual([]);
    expect(resolveGuideList(undefined, undefined)).toEqual([]);
  });

  /** A single clinic item still beats the whole platform list — one is an opinion, not a gap. */
  it('does not top up a short clinic list', () => {
    expect(resolveGuideList(['only one'], DEFAULTS)).toEqual(['only one']);
  });

  /** Callers hold the result; handing back the stored array would let them mutate a lean doc. */
  it('copies rather than returning the input array', () => {
    expect(resolveGuideList(OWN, DEFAULTS)).not.toBe(OWN);
    expect(resolveGuideList([], DEFAULTS)).not.toBe(DEFAULTS);
  });
});

describe('resolveGuideBody', () => {
  /**
   * The half-written guide. A clinic with an opinion about red flags and none about what is
   * normal used to publish an empty "what to expect" — their row won whole, empty list included.
   */
  it('resolves each list on its own', () => {
    const body = resolveGuideBody(
      { expected: [], warning: ['clinic red flag'] },
      { expected: ['platform norm'], warning: ['platform red flag'] }
    );

    expect(body.warning).toEqual(['clinic red flag']);
    expect(body.expected).toEqual(['platform norm']);
  });

  it('takes both from the clinic when the clinic wrote both', () => {
    const body = resolveGuideBody(
      { expected: ['clinic norm'], warning: ['clinic red flag'] },
      { expected: ['platform norm'], warning: ['platform red flag'] }
    );

    expect(body).toMatchObject({
      expected: ['clinic norm'],
      warning: ['clinic red flag'],
      usedOwn: true,
    });
  });

  it('takes both from the platform when the clinic has no row', () => {
    const body = resolveGuideBody(null, { expected: ['n'], warning: ['w'] });

    expect(body).toMatchObject({ expected: ['n'], warning: ['w'], usedOwn: false });
  });

  /** `usedOwn` drives the reader-facing "this is the platform's text" flag. */
  describe('usedOwn', () => {
    it('is true when the clinic supplied either list', () => {
      expect(resolveGuideBody({ expected: [], warning: ['w'] }, null).usedOwn).toBe(true);
      expect(resolveGuideBody({ expected: ['n'], warning: [] }, null).usedOwn).toBe(true);
    });

    /** A row holding two empty lists is not authorship, and must not be labelled as it. */
    it('is false for a clinic row with nothing in it', () => {
      const body = resolveGuideBody({ expected: [], warning: [] }, { expected: ['n'], warning: [] });

      expect(body.usedOwn).toBe(false);
      expect(body.expected).toEqual(['n']);
    });
  });

  it('survives both sides being absent', () => {
    expect(resolveGuideBody(null, null)).toEqual({ expected: [], warning: [], usedOwn: false });
  });
});
