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
 * operation and an injectable than between two operations, and writing a bespoke guide per
 * catalogue entry would mean ninety-two sets of procedure-specific clinical claims nobody here is
 * qualified to make. The catalogue grows; this list does not grow with it.
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
 * The catalogue is overwhelmingly non-surgical now: it is a cosmetology and aesthetics list, and
 * lasers, peels, injectables and massage all belong to the non-surgical baseline. The surgical
 * family is reserved for procedures involving incision and theatre recovery — the body and breast
 * operations, the gynaecological plastics, and the vein work that is cut rather than injected.
 *
 * `other` is the unknown case and is deliberately `surgical`, which is the more cautious of the
 * two baselines. Ambiguous entries go there for the same reason: a patient whose procedure nobody
 * classified confidently should read the guidance that says more about bleeding and infection,
 * not less. `stress_incontinence_treatment` and `endovenous_laser_ablation` are the
 * two to check first — both are performed either way depending on the clinic.
 *
 * `liposculpture` is deliberately NOT on the body-contouring draft despite being liposuction work.
 * That draft was written for liposuction and abdominoplasty, and the precedent here is the old
 * `brazilian_butt_lift`, which stayed surgical for exactly this reason. Extending a specific draft
 * to a procedure nobody wrote it for is the inference these families exist to prevent.
 *
 * `mammoplasty` is on the surgical baseline for the same reason: the breast-augmentation draft was
 * written for augmentation, and mammoplasty is the umbrella term that also covers reduction and
 * lift. Retired `breast_augmentation` rows keep that draft — see the legacy table below.
 */
const FAMILY_BY_PROCEDURE: Record<ProcedureTypeKey, SeedFamily> = {
  carboxytherapy: 'nonSurgical',
  laser_resurfacing: 'nonSurgical',
  tattoo_removal: 'nonSurgical',
  diamond_dermabrasion: 'nonSurgical',
  cold_plasma: 'nonSurgical',
  lip_rejuvenation_liplase: 'nonSurgical',
  emsculpt_body_sculpting: 'nonSurgical',
  electrocoagulation: 'nonSurgical',
  photorejuvenation_ipl: 'nonSurgical',
  microneedling: 'nonSurgical',
  laser_hair_removal: 'nonSurgical',
  carbon_peel: 'nonSurgical',
  lpg_massage: 'nonSurgical',
  fotona_4d_facial: 'nonSurgical',
  mesotherapy: 'nonSurgical',
  botox_injection: 'nonSurgical',
  biorevitalisation: 'nonSurgical',
  prp_facial: 'nonSurgical',
  prp_body: 'nonSurgical',
  hydrafacial: 'nonSurgical',
  hyperhidrosis_treatment: 'nonSurgical',
  poly_lactic_acid: 'nonSurgical',
  contour_plasty: 'nonSurgical',
  facial_cleansing: 'nonSurgical',
  exosome_therapy: 'nonSurgical',
  acne_treatment: 'nonSurgical',
  rf_microneedling: 'nonSurgical',
  dermapen: 'nonSurgical',
  dermal_filler: 'nonSurgical',
  chemical_peel: 'nonSurgical',
  ultherapy_hifu: 'nonSurgical',
  pigmentation_scar_treatment: 'nonSurgical',
  phototherapy: 'nonSurgical',
  mammoplasty: 'surgical',
  blepharoplasty: 'surgical',
  brow_lift: 'surgical',
  liposuction: 'bodyContouring',
  femoroplasty: 'surgical',
  torsoplasty: 'surgical',
  facelift: 'surgical',
  abdominoplasty: 'bodyContouring',
  brachioplasty: 'surgical',
  gynecomastia_surgery: 'surgical',
  liposculpture: 'surgical',
  rhinoplasty: 'rhinoplasty',
  labiaplasty: 'surgical',
  perineoplasty: 'surgical',
  vaginoplasty: 'surgical',
  clitoral_hood_reduction: 'surgical',
  stress_incontinence_treatment: 'surgical',
  vaginal_introitus_narrowing: 'surgical',
  chemical_peel_gynecological: 'nonSurgical',
  prp_gynecological: 'nonSurgical',
  g_spot_augmentation: 'nonSurgical',
  labia_majora_plasty: 'surgical',
  endovenous_laser_ablation: 'surgical',
  sclerotherapy: 'nonSurgical',
  miniphlebectomy: 'surgical',
  thread_lift: 'nonSurgical',
  anti_cellulite_therapy: 'nonSurgical',
  lymphatic_drainage: 'nonSurgical',
  myostimulation: 'nonSurgical',
  skin_tightening_therapy: 'nonSurgical',
  sagging_skin_recovery: 'nonSurgical',
  body_correction: 'nonSurgical',
  emslim_body_sculpting: 'nonSurgical',
  localised_fat_reduction: 'nonSurgical',
  hair_exosome_therapy: 'nonSurgical',
  hair_mesotherapy: 'nonSurgical',
  dermatoscopy: 'nonSurgical',
  viral_papilloma_removal: 'nonSurgical',
  seborrheic_keratosis_removal: 'nonSurgical',
  fibroma_removal: 'nonSurgical',
  lentigo_removal: 'nonSurgical',
  wart_removal: 'nonSurgical',
  demodex_treatment: 'nonSurgical',
  rosacea_treatment: 'nonSurgical',
  onychomycosis_treatment: 'nonSurgical',
  facial_vascular_lesion_treatment: 'nonSurgical',
  non_surgical_blepharoplasty: 'nonSurgical',
  vector_lift: 'nonSurgical',
  lipolytics: 'nonSurgical',
  krf_lifting: 'nonSurgical',
  shockwave_therapy: 'nonSurgical',
  pressotherapy: 'nonSurgical',
  electrolysis: 'nonSurgical',
  seasonal_peels: 'nonSurgical',
  facial_massage: 'nonSurgical',
  body_wraps: 'nonSurgical',
  express_spa: 'nonSurgical',
  general_body_massage: 'nonSurgical',
  other: 'surgical',
};

/**
 * Keys that left the catalogue but are still stored on procedures created before it changed.
 *
 * `manipulationType` is a plain string on a saved document, so retiring a key from the dropdown
 * does not retire it from the database. Without this table those patients would silently drop to
 * the `surgical` fallback — which is harmless for most of them, and wrong for `breast_augmentation`:
 * it has a draft a clinician wrote for that operation, and losing it would replace reviewed content
 * with a generic baseline for people already mid-recovery.
 *
 * The rest resolve to what they always resolved to. They are listed rather than left to the
 * fallback so the record of what these keys meant survives in one place.
 */
const RETIRED_FAMILY_BY_PROCEDURE: Record<string, SeedFamily> = {
  breast_augmentation: 'breastAugmentation',
  breast_lift: 'surgical',
  breast_reduction: 'surgical',
  otoplasty: 'surgical',
  brazilian_butt_lift: 'surgical',
  hair_transplant: 'surgical',
};

/**
 * The fallback is `surgical` and not a thrown error on purpose: `manipulationType` is a stored
 * string, so a procedure key added to the catalogue — or one written by an older build — must
 * still resolve to something a patient can safely read.
 */
export function seedFamilyFor(manipulationType: string): SeedFamily {
  return (
    FAMILY_BY_PROCEDURE[manipulationType as ProcedureTypeKey] ??
    RETIRED_FAMILY_BY_PROCEDURE[manipulationType] ??
    'surgical'
  );
}

/** Every procedure type in the catalogue gets a draft in both languages — one pair per key. */
export const SEED_PROCEDURE_KEYS: ProcedureTypeKey[] = PROCEDURE_TYPES.map(type => type.key);
