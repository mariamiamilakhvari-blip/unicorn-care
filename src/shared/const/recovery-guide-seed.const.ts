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
 * Which draft a procedure starts from.
 *
 * Two of these are baselines and three are specific. The baselines — `surgical` and `nonSurgical` —
 * say only what is true of any procedure in their family: recovery differs far more between an
 * operation and an injectable than between two operations, and writing eighteen bespoke guides
 * would mean eighteen sets of procedure-specific clinical claims nobody here is qualified to make.
 *
 * The three specific families exist because a clinician supplied their content. They are not
 * inferred from the baselines and they are not generated; each was written down for that procedure
 * and reviewed as such. That is the bar for adding a fourth: not "this operation feels different"
 * but "somebody qualified wrote this and signed off on it".
 *
 * Everything else keeps its baseline, which is the correct answer rather than a gap — a
 * blepharoplasty patient reading the surgical draft is reading true things, just not narrow ones.
 */
export const SEED_PROCEDURE_FAMILIES = [
  'rhinoplasty',
  'bodyContouring',
  'breastAugmentation',
] as const;

export const SEED_BASELINE_FAMILIES = ['surgical', 'nonSurgical'] as const;

export const SEED_FAMILIES = [...SEED_PROCEDURE_FAMILIES, ...SEED_BASELINE_FAMILIES] as const;

export type SeedProcedureFamily = (typeof SEED_PROCEDURE_FAMILIES)[number];
export type SeedBaselineFamily = (typeof SEED_BASELINE_FAMILIES)[number];
export type SeedFamily = SeedProcedureFamily | SeedBaselineFamily;

/** Whether a family was written for one procedure, or is a baseline true of a whole class. */
export function isProcedureFamily(family: SeedFamily): family is SeedProcedureFamily {
  return (SEED_PROCEDURE_FAMILIES as readonly string[]).includes(family);
}

/**
 * `other` is deliberately `surgical`: it is the unknown case, and the surgical baseline is the
 * more cautious of the two. A patient whose procedure nobody classified should be reading the
 * guidance that says more about bleeding and infection, not less.
 *
 * `thread_lift` sits with the non-surgical family because it is an office procedure, but it is
 * the least clear-cut assignment here and is the first one a reviewing clinician should check.
 *
 * `brazilian_butt_lift` stays on the surgical baseline despite being body contouring. The
 * contouring draft was written for liposuction and abdominoplasty; extending it to a procedure it
 * was not written for would be exactly the inference these drafts exist to avoid.
 */
const FAMILY_BY_PROCEDURE: Record<ProcedureTypeKey, SeedFamily> = {
  rhinoplasty: 'rhinoplasty',
  breast_augmentation: 'breastAugmentation',
  breast_lift: 'surgical',
  breast_reduction: 'surgical',
  liposuction: 'bodyContouring',
  abdominoplasty: 'bodyContouring',
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

/**
 * The fallback is `surgical` and not a thrown error on purpose: `manipulationType` is a stored
 * string, so a procedure key added to the catalogue — or one written by an older build — must
 * still resolve to something a patient can safely read.
 */
export function seedFamilyFor(manipulationType: string): SeedFamily {
  return FAMILY_BY_PROCEDURE[manipulationType as ProcedureTypeKey] ?? 'surgical';
}

/** Every procedure type gets a draft in both languages — 18 × 2 rows. */
export const SEED_PROCEDURE_KEYS: ProcedureTypeKey[] = PROCEDURE_TYPES.map(type => type.key);
