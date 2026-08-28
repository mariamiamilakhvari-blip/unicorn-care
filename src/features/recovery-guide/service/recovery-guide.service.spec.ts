import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-guide/repository/recovery-guide.repository', () => ({
  recoveryGuideRepository: {
    findForClinic: vi.fn(),
    findDefault: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  },
}));

import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import {
  resolveGuideService,
  upsertGuideService,
} from '@/features/recovery-guide/service/recovery-guide.service';
import { RecoveryGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { AppLocale } from '@/shared/types/roles';

const repo = vi.mocked(recoveryGuideRepository);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const TYPE = 'rhinoplasty';

const guide = (locale: AppLocale, title: string, isPublished = true) => ({
  _id: { toString: () => `guide-${locale}` },
  manipulationType: TYPE,
  locale,
  expected: [{ title, description: '', fromDay: 0, toDay: 3 }],
  warning: [],
  isPublished,
});

/**
 * A patient reads this panel unsupervised, days after surgery, in whichever language they picked.
 *
 * The rule being pinned is that they are never shown nothing when the clinic has written
 * *something* — and never shown a translation, because nothing here translates clinic-authored
 * clinical text and a plausible-looking mistranslation of "call us if your temperature exceeds
 * 38" is a safety failure rather than a rough edge.
 */
describe('resolveGuideService', () => {
  beforeEach(() => {
    // `reset`, not `clear`: the cases below queue `…Once` implementations, and `clearAllMocks`
    // leaves those in place — a leftover queue makes a later case pass or fail for the wrong
    // reason. Reset wipes them, then "nothing found anywhere" is re-established as the baseline.
    vi.resetAllMocks();
    repo.findForClinic.mockResolvedValue(null);
    repo.findDefault.mockResolvedValue(null);
  });

  it("prefers the clinic's own guide in the requested language", async () => {
    repo.findForClinic.mockResolvedValueOnce(guide('en', 'Swelling') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(200);
    expect((result.data as RecoveryGuideView).locale).toBe('en');
    expect((result.data as RecoveryGuideView).isDefault).toBe(false);
  });

  it('falls back to the platform default in the requested language', async () => {
    repo.findDefault.mockResolvedValueOnce(guide('en', 'Swelling') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect((result.data as RecoveryGuideView).isDefault).toBe(true);
    expect((result.data as RecoveryGuideView).locale).toBe('en');
  });

  /*
    The rule that matters most here, and the one most likely to be "helpfully" undone later: a
    reader is shown their own language or nothing. Content in a language they did not choose is
    not guidance they can act on, and under a "when to contact the clinic" heading it is worse
    than the honest empty state the portal renders instead. It also keeps the clinic's own editor
    honest — the care plan builder resolves through here, and a cross-language answer would load
    Georgian into an English form.
  */
  it("does not serve the clinic's other language, and says why", async () => {
    // English asked for; the clinic has only ever written Georgian.
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'შესიება') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
    // Not NOT_FOUND: a guide exists, and telling the patient nobody wrote one would be false.
    expect(result.data).toEqual({ error: 'NOT_TRANSLATED' });
  });

  it('does not serve the platform default in the other language either', async () => {
    repo.findDefault.mockImplementation(async (_type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'შესიება') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.data).toEqual({ error: 'NOT_TRANSLATED' });
  });

  it('reports an unpublished draft in the other language as missing, not untranslated', async () => {
    // A draft is not something the patient could be given in any language, so promising them a
    // translation exists would send them to the clinic asking for a document nobody can hand over.
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'Draft', false) as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.data).toEqual({ error: 'NOT_FOUND' });
  });

  it('never serves content from a language other than the one requested', async () => {
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'შესიება') as never) : null
    );
    repo.findDefault.mockImplementation(async (_type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'platform') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    // The other language is looked at to choose a message, never to produce a payload.
    expect(result.status).toBe(404);
    expect(result.data).not.toHaveProperty('expected');
  });

  it('never serves an unpublished clinic guide — a draft is not reference material', async () => {
    repo.findForClinic.mockResolvedValueOnce(guide('en', 'Draft', false) as never);
    repo.findDefault.mockResolvedValueOnce(guide('en', 'Published') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect((result.data as RecoveryGuideView).expected[0].title).toBe('Published');
  });

  /*
    The rule that a draft never reaches a patient is about the text, not about who owns the row.
    Every platform default is seeded unpublished, and this reader was the one serving them anyway
    — so a clinic that had written no guide for a procedure had five expected signs and seven
    warning signs of unreviewed generic text standing on its portal under its own name.
  */
  it('never serves an unpublished platform default either', async () => {
    repo.findDefault.mockResolvedValueOnce(guide('en', 'Unreviewed draft', false) as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'NOT_FOUND' });
  });

  /*
    The production shape of this bug. A clinic writes its guide in English and never translates
    it; the Georgian reader has no clinic row, falls to the Georgian platform default, and used to
    be shown the platform's full list as though the clinic had written it. The honest answer is
    that their clinic wrote this in a language they did not pick.
  */
  it('tells a Georgian reader their clinic wrote English, rather than serving the draft default', async () => {
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'en' ? (guide('en', 'Redness') as never) : null
    );
    repo.findDefault.mockImplementation(
      async (_type, wanted) => guide(wanted, 'Platform draft', false) as never
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'ka');

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'NOT_TRANSLATED' });
  });

  /*
    A draft in the other language is not a translation anybody can hand over, so promising one
    would send the patient to the clinic asking for a document that does not exist. The same rule
    the clinic's own rows have always followed.
  */
  it('reports an unpublished default in the other language as missing, not untranslated', async () => {
    repo.findDefault.mockImplementation(async (_type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'Platform draft', false) as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.data).toEqual({ error: 'NOT_FOUND' });
  });

  /*
    The clinic's own row still fills its empty lists from the default — but only from one a
    clinician has published, so an unreviewed half cannot arrive attached to a reviewed one.
  */
  it('does not fill a clinic gap from an unpublished default', async () => {
    repo.findForClinic.mockResolvedValueOnce({
      ...guide('en', 'Swelling'),
      warning: [],
    } as never);
    repo.findDefault.mockResolvedValueOnce({
      ...guide('en', 'Platform draft', false),
      warning: [{ title: 'Unreviewed red flag', description: '', severity: 'call', fromDay: 0, toDay: 30 }],
    } as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(200);
    expect((result.data as RecoveryGuideView).warning).toEqual([]);
  });

  it('reports NOT_FOUND when no guide exists in any language', async () => {
    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'NOT_FOUND' });
  });

  it('applies the same rule to a Georgian reader with only English content', async () => {
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'en' ? (guide('en', 'Swelling') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'ka');

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'NOT_TRANSLATED' });
  });
});

/**
 * The editor collects one number per item and the document keeps the pair it always had.
 *
 * Everything on the patient side works in windows: the daily email asks whether today falls inside
 * one, the portal prints the range, and an expected sign's reminder fires on its start day. So the
 * duration is widened back into a window here rather than those readers being taught a new shape.
 */
describe('upsertGuideService — a duration becomes a stored window', () => {
  const USER_ID = '507f1f77bcf86cd799439099';

  const input = {
    manipulationType: TYPE,
    locale: 'ka' as const,
    expected: [{ title: 'Swelling', description: 'Settles', durationDays: 21 }],
    warning: [
      { title: 'Fever', description: 'Call us', severity: 'urgent' as const, durationDays: 60 },
    ],
    isPublished: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findForClinic.mockResolvedValue(null);
    repo.create.mockResolvedValue('new-id');
    repo.findById.mockResolvedValue({
      _id: { toString: () => 'new-id' },
      manipulationType: TYPE,
      locale: 'ka',
      expected: [{ title: 'Swelling', description: 'Settles', fromDay: 0, toDay: 21 }],
      warning: [
        { title: 'Fever', description: 'Call us', severity: 'urgent', fromDay: 0, toDay: 60 },
      ],
      isPublished: true,
    } as never);
  });

  it('stores an expected item as day 0 to its duration', async () => {
    await upsertGuideService(CLINIC_ID, USER_ID, input);

    const written = repo.create.mock.calls[0][0];
    expect(written.expected[0]).toMatchObject({ fromDay: 0, toDay: 21 });
  });

  it('stores a warning the same way, severity intact', async () => {
    await upsertGuideService(CLINIC_ID, USER_ID, input);

    const written = repo.create.mock.calls[0][0];
    expect(written.warning[0]).toMatchObject({ fromDay: 0, toDay: 60, severity: 'urgent' });
  });

  /* `durationDays` is an editor concept. Letting it reach the document would store a dead field. */
  it('never writes durationDays to the document', async () => {
    await upsertGuideService(CLINIC_ID, USER_ID, input);

    const written = repo.create.mock.calls[0][0];
    expect(written.expected[0]).not.toHaveProperty('durationDays');
    expect(written.warning[0]).not.toHaveProperty('durationDays');
  });

  it('reads the window back out as a duration', async () => {
    const { data } = await upsertGuideService(CLINIC_ID, USER_ID, input);
    const view = data as RecoveryGuideView;

    expect(view.expected[0]).toMatchObject({ fromDay: 0, toDay: 21 });
  });

  it('widens a zero duration into a same-day window rather than dropping it', async () => {
    await upsertGuideService(CLINIC_ID, USER_ID, {
      ...input,
      warning: [{ title: 'Now', description: '', severity: 'emergency' as const, durationDays: 0 }],
    });

    const written = repo.create.mock.calls[0][0];
    expect(written.warning[0]).toMatchObject({ fromDay: 0, toDay: 0 });
  });
});

/**
 * P1 — the platform's generic guidance was rendering underneath the clinic's own on the portal,
 * and a patient reading "when to call your clinic" could not tell which lines their own surgeon
 * had written. Resolution is now per list: whatever the clinic said on a subject is the whole of
 * what the patient is shown on that subject.
 */
describe('resolveGuideService — custom content is never padded with the default', () => {
  const body = (
    expected: string[],
    warning: string[],
    isPublished = true
  ) => ({
    _id: { toString: () => 'row' },
    manipulationType: TYPE,
    locale: 'en',
    expected: expected.map(title => ({ title, description: '', fromDay: 0, toDay: 3 })),
    warning: warning.map(title => ({
      title,
      description: '',
      severity: 'call_clinic',
      fromDay: 0,
      toDay: 14,
    })),
    isPublished,
  });

  const view = (result: Awaited<ReturnType<typeof resolveGuideService>>) =>
    result.data as RecoveryGuideView;

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findForClinic.mockResolvedValue(null);
    repo.findDefault.mockResolvedValue(
      body(['platform norm'], ['platform red flag']) as never
    );
  });

  it('shows only the clinic red flags when the clinic wrote red flags', async () => {
    repo.findForClinic.mockResolvedValueOnce(
      body(['clinic norm'], ['clinic red flag']) as never
    );

    const result = view(await resolveGuideService(CLINIC_ID, TYPE, 'en'));

    expect(result.warning.map(item => item.title)).toEqual(['clinic red flag']);
    expect(result.expected.map(item => item.title)).toEqual(['clinic norm']);
  });

  /**
   * The half-written guide. A clinic with an opinion about red flags and none about what is normal
   * used to publish an empty "what to expect", because its row won whole — empty list included.
   */
  it('fills only the half the clinic left empty', async () => {
    repo.findForClinic.mockResolvedValueOnce(body([], ['clinic red flag']) as never);

    const result = view(await resolveGuideService(CLINIC_ID, TYPE, 'en'));

    expect(result.warning.map(item => item.title)).toEqual(['clinic red flag']);
    expect(result.expected.map(item => item.title)).toEqual(['platform norm']);
  });

  /** One clinic item is an opinion, not a gap — it is not topped up to the platform's list. */
  it('does not top up a shorter clinic list', async () => {
    repo.findDefault.mockResolvedValue(
      body(['p1'], ['w1', 'w2', 'w3']) as never
    );
    repo.findForClinic.mockResolvedValueOnce(body(['c1'], ['only one']) as never);

    const result = view(await resolveGuideService(CLINIC_ID, TYPE, 'en'));

    expect(result.warning).toHaveLength(1);
  });

  /** The reader-facing flag has to follow the content, not the row it was read from. */
  it('still reports the platform as the source for a clinic row with nothing in it', async () => {
    repo.findForClinic.mockResolvedValueOnce(body([], []) as never);

    const result = view(await resolveGuideService(CLINIC_ID, TYPE, 'en'));

    expect(result.isDefault).toBe(true);
    expect(result.expected.map(item => item.title)).toEqual(['platform norm']);
  });

  /** Unpublished clinic content is absent, so the default stands alone rather than merging in. */
  it('ignores an unpublished clinic row entirely', async () => {
    repo.findForClinic.mockResolvedValueOnce(
      body(['draft norm'], ['draft red flag'], false) as never
    );

    const result = view(await resolveGuideService(CLINIC_ID, TYPE, 'en'));

    expect(result.expected.map(item => item.title)).toEqual(['platform norm']);
    expect(result.warning.map(item => item.title)).toEqual(['platform red flag']);
  });
});
