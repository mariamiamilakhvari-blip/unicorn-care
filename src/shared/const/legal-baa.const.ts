/**
 * The HIPAA Business Associate Agreement, in both locales.
 *
 * A baseline drafted from what the system actually does — the sub-processors it really uses, the
 * safeguards it really applies, the deletion path that really exists. It is not legal advice and
 * must be reviewed by counsel in the operating jurisdiction before a US clinic relies on it. A
 * clinic that needs a countersigned copy asks for one at the contact address; the page states so.
 *
 * Written in both languages even though HIPAA binds US clinics only. A Georgian clinic reading
 * the site in Georgian must still be able to see what a US clinic is being asked to accept, and
 * a document that appears in one locale as untranslated English reads as boilerplate nobody owns.
 *
 * The two halves live in their own files: together they run past the file-length limit, and one
 * document per file is the convention the other legal texts already follow.
 */
import { LEGAL_BAA_EN } from '@/shared/const/legal-baa-en.const';
import { LEGAL_BAA_KA } from '@/shared/const/legal-baa-ka.const';
import { LegalDocument } from '@/shared/const/legal.types';
import { AppLocale } from '@/shared/types/roles';

export const LEGAL_BAA: Record<AppLocale, LegalDocument> = {
  en: LEGAL_BAA_EN,
  ka: LEGAL_BAA_KA,
};
