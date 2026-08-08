import { PROCEDURE_TYPES, ProcedureTypeKey } from '@/shared/const/procedure.const';
import { WarningSeverity } from '@/shared/const/recovery.const';

export type SeedExpectedItem = {
  title: string;
  description: string;
  fromDay: number;
  toDay: number;
};

export type SeedWarningItem = SeedExpectedItem & { severity: WarningSeverity };

export type SeedGuideBody = {
  expected: SeedExpectedItem[];
  warning: SeedWarningItem[];
};

/**
 * Recovery patterns differ far more between surgery and an injectable than between two
 * operations, so the drafts are written per family rather than per procedure.
 *
 * Writing eighteen bespoke guides would mean eighteen sets of procedure-specific clinical claims
 * that nobody here is qualified to make. Two conservative baselines say only what is true of any
 * procedure in the family, and leave the specifics to the clinician who reviews them.
 */
export const SEED_FAMILIES = ['surgical', 'nonSurgical'] as const;

export type SeedFamily = (typeof SEED_FAMILIES)[number];

/**
 * Which baseline each procedure starts from.
 *
 * `other` is deliberately `surgical`: it is the unknown case, and the surgical baseline is the
 * more cautious of the two. A patient whose procedure nobody classified should be reading the
 * guidance that says more about bleeding and infection, not less.
 *
 * `thread_lift` sits with the non-surgical family because it is an office procedure, but it is
 * the least clear-cut assignment here and is the first one a reviewing clinician should check.
 */
const FAMILY_BY_PROCEDURE: Record<ProcedureTypeKey, SeedFamily> = {
  rhinoplasty: 'surgical',
  breast_augmentation: 'surgical',
  breast_lift: 'surgical',
  breast_reduction: 'surgical',
  liposuction: 'surgical',
  abdominoplasty: 'surgical',
  blepharoplasty: 'surgical',
  facelift: 'surgical',
  otoplasty: 'surgical',
  gynecomastia_surgery: 'surgical',
  brazilian_butt_lift: 'surgical',
  hair_transplant: 'surgical',
  botox_injection: 'nonSurgical',
  dermal_filler: 'nonSurgical',
  chemical_peel: 'nonSurgical',
  laser_resurfacing: 'nonSurgical',
  thread_lift: 'nonSurgical',
  other: 'surgical',
};

export function seedFamilyFor(manipulationType: string): SeedFamily {
  return FAMILY_BY_PROCEDURE[manipulationType as ProcedureTypeKey] ?? 'surgical';
}

/** Every procedure type gets a draft in both languages — 18 × 2 rows. */
export const SEED_PROCEDURE_KEYS: ProcedureTypeKey[] = PROCEDURE_TYPES.map(type => type.key);
