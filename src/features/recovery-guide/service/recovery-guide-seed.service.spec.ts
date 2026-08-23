import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-guide/repository/recovery-guide.repository', () => ({
  recoveryGuideRepository: { upsertDefault: vi.fn(), refreshDefault: vi.fn() },
}));

import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { seedDefaultRecoveryGuidesService } from '@/features/recovery-guide/service/recovery-guide-seed.service';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

const guides = vi.mocked(recoveryGuideRepository);

const SLOTS = PROCEDURE_TYPES.length * 2;

const written = () => guides.upsertDefault.mock.calls.map(call => call[0]);

describe('seedDefaultRecoveryGuidesService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    guides.upsertDefault.mockResolvedValue(true);
    guides.refreshDefault.mockResolvedValue(true);
  });

  it('writes one draft per procedure type per language', async () => {
    const { data } = await seedDefaultRecoveryGuidesService();

    expect(guides.upsertDefault).toHaveBeenCalledTimes(SLOTS);
    expect(data).toEqual({ inserted: SLOTS, skipped: 0, refreshed: 0 });
  });

  it('covers both languages for every procedure', async () => {
    await seedDefaultRecoveryGuidesService();

    for (const type of PROCEDURE_TYPES) {
      const locales = written()
        .filter(row => row.manipulationType === type.key)
        .map(row => row.locale)
        .sort();
      expect(locales).toEqual(['en', 'ka']);
    }
  });

  /**
   * The drafts are generic by necessity, so they are not clinical advice until a clinician has
   * read them. Seeding them published would put unreviewed text in front of post-operative
   * patients on the highest-liability surface in the product.
   */
  it('seeds every draft unpublished', async () => {
    await seedDefaultRecoveryGuidesService();

    expect(written().every(row => row.isPublished === false)).toBe(true);
  });

  it('writes platform rows, owned by no clinic', async () => {
    await seedDefaultRecoveryGuidesService();

    expect(written().every(row => row.clinicId === null)).toBe(true);
  });

  /** Naming the admin who ran the seed would attribute generic text to someone who never wrote it. */
  it('attributes the content to nobody', async () => {
    await seedDefaultRecoveryGuidesService();

    expect(written().every(row => row.updatedByUserId === null)).toBe(true);
  });

  it('gives every row expected and warning content', async () => {
    await seedDefaultRecoveryGuidesService();

    for (const row of written()) {
      expect(row.expected.length).toBeGreaterThan(0);
      expect(row.warning.length).toBeGreaterThan(0);
    }
  });

  it('gives an injectable procedure different guidance from an operation', async () => {
    await seedDefaultRecoveryGuidesService();

    const botox = written().find(row => row.manipulationType === 'botox_injection' && row.locale === 'en');
    const facelift = written().find(row => row.manipulationType === 'facelift' && row.locale === 'en');

    expect(botox?.expected[0].title).not.toBe(facelift?.expected[0].title);
  });

  /**
   * Seeding runs more than once — on deploy, by hand, after a procedure type is added. By then a
   * clinician may have corrected a draft or published it, and the repository refuses to touch an
   * existing row. A second run therefore fills nothing and reports every slot as skipped.
   */
  describe('run again', () => {
    it('inserts nothing when every slot is already filled', async () => {
      guides.upsertDefault.mockResolvedValue(false);

      const { data } = await seedDefaultRecoveryGuidesService();

      expect(data).toEqual({ inserted: 0, skipped: SLOTS, refreshed: 0 });
    });

    it('fills only the gaps when some slots exist', async () => {
      // One empty slot among the rest — what a newly added procedure type looks like.
      guides.upsertDefault.mockResolvedValue(false);
      guides.upsertDefault.mockResolvedValueOnce(true);

      const { data } = await seedDefaultRecoveryGuidesService();

      expect(data).toEqual({ inserted: 1, skipped: SLOTS - 1, refreshed: 0 });
    });
  });

  it('answers 200', async () => {
    expect((await seedDefaultRecoveryGuidesService()).status).toBe(200);
  });
});

/**
 * Templates changed after the defaults were seeded, so the stored rows went stale: a rhinoplasty
 * patient at a clinic that never wrote its own guide kept reading the generic surgical text. The
 * refresh is how the new content reaches them — and it is opt-in, because rewriting the platform's
 * clinical reference material should never be a side effect of running a seed out of habit.
 */
describe('seedDefaultRecoveryGuidesService — refreshing stale defaults', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    guides.upsertDefault.mockResolvedValue(false);
    guides.refreshDefault.mockResolvedValue(true);
  });

  it('leaves existing defaults alone unless asked', async () => {
    const { data } = await seedDefaultRecoveryGuidesService();

    expect(guides.refreshDefault).not.toHaveBeenCalled();
    expect(data).toEqual({ inserted: 0, skipped: SLOTS, refreshed: 0 });
  });

  it('rewrites every existing default when asked', async () => {
    const { data } = await seedDefaultRecoveryGuidesService({ refresh: true });

    expect(guides.refreshDefault).toHaveBeenCalledTimes(SLOTS);
    expect(data).toEqual({ inserted: 0, skipped: 0, refreshed: SLOTS });
  });

  /* A slot that was empty is an insert, not a refresh — it was never stale. */
  it('does not refresh a slot it has just inserted', async () => {
    guides.upsertDefault.mockResolvedValue(true);

    const { data } = await seedDefaultRecoveryGuidesService({ refresh: true });

    expect(guides.refreshDefault).not.toHaveBeenCalled();
    expect(data).toEqual({ inserted: SLOTS, skipped: 0, refreshed: 0 });
  });

  /* The refreshed text is the procedure-specific draft, not the baseline it replaces. */
  it('writes the procedure-specific draft for a mapped procedure', async () => {
    await seedDefaultRecoveryGuidesService({ refresh: true });

    const row = guides.refreshDefault.mock.calls
      .map(call => call[0])
      .find(candidate => candidate.manipulationType === 'rhinoplasty' && candidate.locale === 'en');

    expect(row?.expected.map(item => item.title).join(' | ')).toContain('nasal congestion');
  });
});
