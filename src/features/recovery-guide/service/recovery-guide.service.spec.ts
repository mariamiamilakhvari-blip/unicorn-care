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

  it("falls back to the clinic's other language rather than showing an empty panel", async () => {
    // English asked for; the clinic has only ever written Georgian.
    repo.findForClinic.mockResolvedValueOnce(null).mockResolvedValueOnce(guide('ka', 'შესიება') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(200);
    // The view reports the language it is actually in, so the portal can say so.
    expect((result.data as RecoveryGuideView).locale).toBe('ka');
    expect((result.data as RecoveryGuideView).expected[0].title).toBe('შესიება');
  });

  it("prefers the clinic's other language over the platform default in that language", async () => {
    repo.findForClinic.mockResolvedValueOnce(null).mockResolvedValueOnce(guide('ka', 'clinic') as never);
    repo.findDefault.mockResolvedValueOnce(null).mockResolvedValueOnce(guide('ka', 'platform') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect((result.data as RecoveryGuideView).isDefault).toBe(false);
    expect((result.data as RecoveryGuideView).expected[0].title).toBe('clinic');
  });

  it('falls back to the platform default in the other language as a last resort', async () => {
    repo.findDefault.mockResolvedValueOnce(null).mockResolvedValueOnce(guide('ka', 'შესიება') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(200);
    expect((result.data as RecoveryGuideView).locale).toBe('ka');
    expect((result.data as RecoveryGuideView).isDefault).toBe(true);
  });

  it('never serves an unpublished clinic guide — a draft is not reference material', async () => {
    repo.findForClinic.mockResolvedValueOnce(guide('en', 'Draft', false) as never);
    repo.findDefault.mockResolvedValueOnce(guide('en', 'Published') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect((result.data as RecoveryGuideView).expected[0].title).toBe('Published');
  });

  it('404s only when no guide exists in either language', async () => {
    const result = await resolveGuideService(CLINIC_ID, TYPE, 'en');

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'NOT_FOUND' });
  });

  it('works in the same way for a Georgian reader with only English content', async () => {
    repo.findForClinic.mockResolvedValueOnce(null).mockResolvedValueOnce(guide('en', 'Swelling') as never);

    const result = await resolveGuideService(CLINIC_ID, TYPE, 'ka');

    expect((result.data as RecoveryGuideView).locale).toBe('en');
  });
});
