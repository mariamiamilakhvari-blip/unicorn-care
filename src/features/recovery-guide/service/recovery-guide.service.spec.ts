import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-guide/repository/recovery-guide.repository', () => ({
  recoveryGuideRepository: {
    findForClinic: vi.fn(),
    findDefault: vi.fn(),
  },
}));

import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { resolveGuideService } from '@/features/recovery-guide/service/recovery-guide.service';
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
  it("does not fall back to the clinic's other language", async () => {
    // English asked for; the clinic has only ever written Georgian.
    repo.findForClinic.mockImplementation(async (_clinic, _type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'შესიება') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
  });

  it('does not fall back to the platform default in the other language', async () => {
    repo.findDefault.mockImplementation(async (_type, wanted) =>
      wanted === 'ka' ? (guide('ka', 'შესიება') as never) : null
    );

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
  });

  it('never looks past the requested language at all', async () => {
    await resolveGuideService(CLINIC_ID, TYPE, 'en');

    for (const call of repo.findForClinic.mock.calls) expect(call[2]).toBe('en');
    for (const call of repo.findDefault.mock.calls) expect(call[1]).toBe('en');
  });

  it('never serves an unpublished clinic guide — a draft is not reference material', async () => {
    repo.findForClinic.mockResolvedValueOnce(guide('en', 'Draft', false) as never);
    repo.findDefault.mockResolvedValueOnce(guide('en', 'Published') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect((result.data as RecoveryGuideView).expected[0].title).toBe('Published');
  });

  it('404s when nothing is published in the requested language', async () => {
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
  });
});
