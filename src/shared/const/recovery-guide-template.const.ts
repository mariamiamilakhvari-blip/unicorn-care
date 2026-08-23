import { RECOVERY_GUIDE_PROCEDURE_EN } from '@/shared/const/recovery-guide-procedure-en.const';
import { RECOVERY_GUIDE_PROCEDURE_KA } from '@/shared/const/recovery-guide-procedure-ka.const';
import { RECOVERY_GUIDE_SEED_EN } from '@/shared/const/recovery-guide-seed-en.const';
import { RECOVERY_GUIDE_SEED_KA } from '@/shared/const/recovery-guide-seed-ka.const';
import {
  isProcedureFamily,
  SeedFamily,
  seedFamilyFor,
  SeedGuideBody,
} from '@/shared/const/recovery-guide-seed.const';
import { AppLocale } from '@/shared/types/roles';

/*
  The two halves are assembled here rather than in either locale file, because a single table of
  five bodies per language does not fit the 200-line limit that split `en` from `ka` in the first
  place. The baselines and the procedure-specific drafts are therefore separate files and this is
  the only place that knows they belong to one lookup.
*/
export const RECOVERY_GUIDE_TEMPLATES: Record<AppLocale, Record<SeedFamily, SeedGuideBody>> = {
  en: { ...RECOVERY_GUIDE_PROCEDURE_EN, ...RECOVERY_GUIDE_SEED_EN },
  ka: { ...RECOVERY_GUIDE_PROCEDURE_KA, ...RECOVERY_GUIDE_SEED_KA },
};

/**
 * The draft guide for one procedure type, in one language.
 *
 * One resolver for two callers that must never disagree: the platform seeder, which fills empty
 * default slots, and the care-plan builder, which offers the same text to a clinic writing its own
 * guide. Before this existed the seeder held the mapping privately, so the builder had nothing to
 * offer and a clinic with no seeded default faced an empty editor on the one screen where "what is
 * normal and what is a warning sign" is supposed to live.
 *
 * Always returns a body. `seedFamilyFor` falls back to the surgical baseline for a procedure it
 * does not recognise — a custom type, or a key from a newer build — so a clinic that typed
 * something unmapped still gets the general plastic-surgery draft rather than nothing.
 *
 * Dependency-free by design: this is reached from a client component, and importing it must not
 * drag Mongoose into the browser bundle. That is why the seed tables live in `const/` and not
 * beside the schema.
 */
export function recoveryGuideTemplate(
  locale: AppLocale,
  manipulationType: string
): SeedGuideBody {
  return RECOVERY_GUIDE_TEMPLATES[locale][seedFamilyFor(manipulationType)];
}

/**
 * Whether the draft for this procedure was written for *this* procedure.
 *
 * The builder says which of the two a clinic is being offered, because they carry different
 * weight: text written for rhinoplasty is worth starting from, and the surgical baseline is worth
 * rewriting. Presenting them identically would invite a clinician to accept the general one as
 * though somebody had considered their operation.
 */
export function hasProcedureSpecificTemplate(manipulationType: string): boolean {
  return isProcedureFamily(seedFamilyFor(manipulationType));
}
