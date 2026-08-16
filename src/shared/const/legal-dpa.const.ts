/**
 * The Data Processing Agreement, in both locales.
 *
 * The controller–processor contract the Law of Georgia on Personal Data Protection requires
 * between a clinic and this platform. A baseline drafted from what the system actually does — the
 * sub-processors it really uses, the safeguards it really applies, the deletion path that really
 * exists. It is not legal advice and must be reviewed by counsel before a clinic relies on it. A
 * clinic that needs a countersigned copy asks for one at the contact address; the page states so.
 *
 * It replaced a HIPAA Business Associate Agreement, which reached only clinics in the United
 * States and reached none of the clinics this product is built for.
 *
 * The two halves live in their own files: together they run past the file-length limit, and one
 * document per file is the convention the other legal texts already follow.
 */
import { LEGAL_DPA_EN } from '@/shared/const/legal-dpa-en.const';
import { LEGAL_DPA_KA } from '@/shared/const/legal-dpa-ka.const';
import { LegalDocument } from '@/shared/const/legal.types';
import { AppLocale } from '@/shared/types/roles';

export const LEGAL_DPA: Record<AppLocale, LegalDocument> = {
  en: LEGAL_DPA_EN,
  ka: LEGAL_DPA_KA,
};
