import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { LOCALE_OPTIONS } from '@/shared/const/locale.const';
import { RECOVERY_GUIDE_SEED_EN } from '@/shared/const/recovery-guide-seed-en.const';
import { RECOVERY_GUIDE_SEED_KA } from '@/shared/const/recovery-guide-seed-ka.const';
import {
  SEED_PROCEDURE_KEYS,
  seedFamilyFor,
  SeedGuideBody,
} from '@/shared/const/recovery-guide-seed.const';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

export type SeedRecoveryGuidesResult = {
  /** Slots that were empty and now hold a draft. */
  inserted: number;
  /** Slots that already existed and were left untouched, edits and all. */
  skipped: number;
};

function bodyFor(locale: AppLocale, manipulationType: string): SeedGuideBody {
  const family = seedFamilyFor(manipulationType);
  return locale === 'ka' ? RECOVERY_GUIDE_SEED_KA[family] : RECOVERY_GUIDE_SEED_EN[family];
}

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
 * Idempotent, and deliberately unable to overwrite. Re-running only fills gaps — a slot that
 * already exists is skipped whether it holds an untouched draft or a rewritten, published guide.
 */
export async function seedDefaultRecoveryGuidesService(): Promise<
  ServiceResult<SeedRecoveryGuidesResult>
  > {
  let inserted = 0;
  let skipped = 0;

  for (const manipulationType of SEED_PROCEDURE_KEYS) {
    for (const { value: locale } of LOCALE_OPTIONS) {
      const body = bodyFor(locale, manipulationType);

      const created = await recoveryGuideRepository.upsertDefault({
        clinicId: null,
        manipulationType,
        locale,
        expected: body.expected,
        warning: body.warning,
        // No author: nobody signed off on generic text, and naming the admin who ran the seed
        // would attribute clinical content to someone who did not write it.
        updatedByUserId: null,
        isPublished: false,
      });

      if (created) inserted += 1;
      else skipped += 1;
    }
  }

  return { data: { inserted, skipped }, status: 200 };
}
