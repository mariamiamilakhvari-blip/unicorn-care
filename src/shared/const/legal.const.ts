/**
 * The Terms of Service and Privacy Policy.
 *
 * The text lives in `legal-terms.const.ts` and `legal-privacy.const.ts` — long-form page content,
 * not interface strings, which is why it is not in `messages/*.json`, and split per document
 * because one file holding both runs past what anyone will read.
 *
 * It describes how the product actually works: the sub-processors it really uses, the data it
 * really stores, the deletion path that really exists. It is a baseline drafted from the system's
 * behaviour, not legal advice, and should be reviewed by a lawyer in the operating jurisdiction
 * before anyone relies on it. Each document carries its own `lastUpdated`, which is what its page
 * displays; move that whenever the substance of that document changes.
 */

import { LEGAL_BAA } from '@/shared/const/legal-baa.const';
import { LEGAL_PRIVACY } from '@/shared/const/legal-privacy.const';
import { TERMS } from '@/shared/const/legal-terms.const';
import { LegalDocument, LegalSlug } from '@/shared/const/legal.types';
import { AppLocale } from '@/shared/types/roles';

export type { LegalDocument, LegalSection, LegalSlug } from '@/shared/const/legal.types';

export { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/shared/const/legal-contact.const';

const DOCUMENTS: Record<LegalSlug, Record<AppLocale, LegalDocument>> = {
  terms: TERMS,
  privacy: LEGAL_PRIVACY,
  baa: LEGAL_BAA,
};

export function legalDocument(slug: LegalSlug, locale: AppLocale): LegalDocument {
  return DOCUMENTS[slug][locale];
}
