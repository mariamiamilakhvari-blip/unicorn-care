import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';
import { DPA_VERSION } from '@/shared/const/consent.const';
import { LEGAL_LAST_UPDATED } from '@/shared/const/legal-contact.const';
import { LegalSlug, legalDocument } from '@/shared/const/legal.const';

const SLUGS: LegalSlug[] = ['terms', 'privacy', 'dpa'];

/**
 * The pages are the product's legal footing, so the things a reader relies on are pinned rather
 * than trusted: that the document exists in the language they are reading it in, and that the
 * date at the top is that document's date and not some other document's.
 */
describe.each(SLUGS)('the %s document', slug => {
  it.each(routing.locales)('exists in %s', locale => {
    const document = legalDocument(slug, locale);
    expect(document.title.length).toBeGreaterThan(0);
    expect(document.sections.length).toBeGreaterThan(0);
  });

  it('carries an ISO date, in both locales', () => {
    for (const locale of routing.locales) {
      expect(legalDocument(slug, locale).lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('is dated the same in both locales — they are one document, translated', () => {
    expect(legalDocument(slug, 'ka').lastUpdated).toBe(legalDocument(slug, 'en').lastUpdated);
  });
});

describe('the dates the pages display', () => {
  it.each(['terms', 'privacy'] as const)('dates %s from the shared revision date', slug => {
    expect(legalDocument(slug, 'en').lastUpdated).toBe(LEGAL_LAST_UPDATED);
  });

  /*
    The DPA is the one document whose date is also recorded, on every clinic that accepts it. If
    the page said one thing and `clinic.dpa.version` another, there would be no answering "which
    text did they agree to" — so the page reads its date from the same constant.
  */
  it('dates the DPA from the version its acceptances are stamped with', () => {
    expect(legalDocument('dpa', 'en').lastUpdated).toBe(DPA_VERSION);
  });

  it('does not re-date the Terms and Privacy Policy when the DPA moves', () => {
    expect(legalDocument('terms', 'en').lastUpdated).not.toBe(DPA_VERSION);
    expect(legalDocument('privacy', 'en').lastUpdated).not.toBe(DPA_VERSION);
  });
});
