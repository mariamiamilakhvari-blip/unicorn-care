import { getLocale } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLegalMetadata } from '@/shared/lib/legal-metadata';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }));

const mockLocale = vi.mocked(getLocale);

describe('buildLegalMetadata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('titles the page from the document in the active locale', async () => {
    mockLocale.mockResolvedValue('ka');
    const ka = await buildLegalMetadata('terms', '/terms');
    expect(ka.title).toBe('მომსახურების პირობები | Unicorn Care');

    mockLocale.mockResolvedValue('en');
    const en = await buildLegalMetadata('terms', '/terms');
    expect(en.title).toBe('Terms of Service | Unicorn Care');
  });

  it('keeps the description inside the length a result snippet shows', async () => {
    mockLocale.mockResolvedValue('en');
    const meta = await buildLegalMetadata('privacy', '/privacy');
    expect(meta.description?.length).toBeLessThanOrEqual(155);
  });

  /*
    Both locales serve the same document at two URLs. Without hreflang Google treats them as
    duplicates and picks one, which is how a policy page ends up unreachable in one language.
  */
  it('points the canonical at the current locale and declares both alternates', async () => {
    mockLocale.mockResolvedValue('en');
    const meta = await buildLegalMetadata('privacy', '/privacy');

    expect(meta.alternates?.canonical).toBe('https://www.unicorncare.space/en/privacy');
    expect(meta.alternates?.languages).toEqual({
      ka: 'https://www.unicorncare.space/privacy',
      en: 'https://www.unicorncare.space/en/privacy',
      'x-default': 'https://www.unicorncare.space/privacy',
    });
  });

  it('leaves Georgian unprefixed, since it is the default locale', async () => {
    mockLocale.mockResolvedValue('ka');
    const meta = await buildLegalMetadata('terms', '/terms');
    expect(meta.alternates?.canonical).toBe('https://www.unicorncare.space/terms');
  });
});
