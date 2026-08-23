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
