import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { LOCALE_OPTIONS } from '@/shared/const/locale.const';
import { SEED_PROCEDURE_KEYS } from '@/shared/const/recovery-guide-seed.const';
import { recoveryGuideTemplate } from '@/shared/const/recovery-guide-template.const';
import { ServiceResult } from '@/shared/types/common';

export type SeedRecoveryGuidesResult = {
  /** Slots that were empty and now hold a draft. */
  inserted: number;
  /** Slots that already existed and were left untouched, edits and all. */
  skipped: number;
  /** Existing platform defaults whose text was rewritten from the current templates. */
  refreshed: number;
};

/**
 * Fills every empty platform-default slot with a conservative draft (PRD 06 §2).
 *
 * The guide resolution order is: the clinic's own guide, then the platform default, then nothing.
 * With no defaults seeded, the second rung did not exist, so a patient whose clinic had not
 * written a guide for their procedure opened the portal to a blank panel — on the surface where
 * "what is normal and what is a warning sign" is supposed to live.
 *
 * Seeded with `isPublished: false`. The drafts are generic by necessity and are not clinical
 * advice until a clinician has read them, so nothing here reaches a patient until someone
 * qualified publishes it. An unpublished default is still better than an empty table: it gives
 * the reviewer something to correct rather than a blank editor to fill from scratch.
 *
 * Idempotent, and by default unable to overwrite. Re-running only fills gaps — a slot that already
 * exists is skipped.
 *
 * `refresh` is the exception, and it exists because the templates themselves changed. Defaults
 * seeded before the procedure-specific drafts were written hold the generic surgical text, so
 * every rhinoplasty patient at a clinic that never wrote its own guide was still reading "swelling
 * around the treated area" — the mapping was right and the stored rows were stale. Refreshing
 * rewrites platform content with platform content and cannot reach a clinic's own guide, which
 * lives under its own `clinicId`. Publication state is left alone: whether a clinician has read a
 * draft is a fact about a person, not about the text, and a refresh does not un-read it.
 *
 * It is off by default all the same. The caller says so explicitly, so nobody rewrites the
 * platform's clinical reference material by running a seed out of habit.
 */
export async function seedDefaultRecoveryGuidesService(
  options: { refresh?: boolean } = {}
): Promise<ServiceResult<SeedRecoveryGuidesResult>> {
  let inserted = 0;
  let skipped = 0;
  let refreshed = 0;

  for (const manipulationType of SEED_PROCEDURE_KEYS) {
    for (const { value: locale } of LOCALE_OPTIONS) {
      const body = recoveryGuideTemplate(locale, manipulationType);

      const payload = {
        clinicId: null,
        manipulationType,
        locale,
        expected: body.expected,
        warning: body.warning,
        // No author: nobody signed off on generic text, and naming the admin who ran the seed
        // would attribute clinical content to someone who did not write it.
        updatedByUserId: null,
        isPublished: false,
      };

      const created = await recoveryGuideRepository.upsertDefault(payload);

      if (created) {
        inserted += 1;
        continue;
      }

      if (options.refresh && (await recoveryGuideRepository.refreshDefault(payload))) {
        refreshed += 1;
        continue;
      }

      skipped += 1;
    }
  }

  return { data: { inserted, skipped, refreshed }, status: 200 };
}
