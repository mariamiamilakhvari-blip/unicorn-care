import { describe, expect, it } from 'vitest';

import { canSuggest, transliterateGeorgian } from '@/shared/utils/transliterate';

/**
 * The Latin suggestion a clinic is offered for its own name and address.
 *
 * It is a starting point, never an answer. What these pin is that the mapping is the national
 * system a Georgian reader recognises from their own passport, that anything already Latin comes
 * through untouched, and — the one that matters most — that a clinic which has typed its own
 * English name never has it overwritten.
 */
describe('transliterateGeorgian', () => {
  it('transliterates a clinic name', () => {
    expect(transliterateGeorgian('გაგუას კლინიკა')).toBe('Gaguas Klinika');
  });

  it('covers every letter of the modern alphabet', () => {
    expect(transliterateGeorgian('აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ')).toBe(
      'Abgdevztiklmnopzhrstupkghqshchtsdztschkhjh'
    );
  });

  /*
    The collisions are the national system's own, not a bug in the table. Reversibility is not what
    this is for — a human reads the result and corrects it, which is the only reason generating it
    is safe at all.
  */
  it.each([
    ['თ', 'ტ', 't'],
    ['ფ', 'პ', 'p'],
    ['ქ', 'კ', 'k'],
    ['ც', 'წ', 'ts'],
    ['ჩ', 'ჭ', 'ch'],
  ])('maps %s and %s onto the same %s, as the standard does', (first, second, latin) => {
    expect(transliterateGeorgian(first).toLowerCase()).toBe(latin);
    expect(transliterateGeorgian(second).toLowerCase()).toBe(latin);
  });

  /* Georgian has no capitals, so a raw transliteration reads like a mistake rather than a name. */
  it('starts each word with a capital', () => {
    expect(transliterateGeorgian('თბილისის სამედიცინო ცენტრი')).toBe(
      'Tbilisis Sameditsino Tsentri'
    );
  });

  it('capitalises after a hyphen or a bracket, where a word also begins', () => {
    expect(transliterateGeorgian('ვაჟა-ფშაველა')).toBe('Vazha-Pshavela');
  });

  /*
    Numbers, punctuation and any Latin the clinic already typed pass through. An address is the
    common case: `N40` must not become `n40`.
  */
  it('leaves digits, punctuation and existing Latin alone', () => {
    expect(transliterateGeorgian('საბურთალო: ვაჟა-ფშაველას გამზ. N40')).toBe(
      'Saburtalo: Vazha-Pshavelas Gamz. N40'
    );
  });

  it('returns nothing for an empty or blank value', () => {
    expect(transliterateGeorgian('')).toBe('');
    expect(transliterateGeorgian('   ')).toBe('');
  });

  it('passes a purely Latin value through unchanged apart from its capitals', () => {
    expect(transliterateGeorgian('Gagua Clinic')).toBe('Gagua Clinic');
  });
});

/**
 * The guard that decides whether a suggestion is allowed to land.
 *
 * A clinic that has typed its own English name has already answered the question this feature
 * exists to ask. Re-answering it for them on every keystroke in the Georgian field would be the
 * feature destroying their work.
 */
describe('canSuggest', () => {
  it('allows a suggestion into an empty field', () => {
    expect(canSuggest('')).toBe(true);
  });

  /* A field opened, spaced and abandoned holds `' '` — truthy, and otherwise locked forever. */
  it('treats a whitespace-only field as empty', () => {
    expect(canSuggest('   ')).toBe(true);
  });

  it('refuses to overwrite a name the clinic typed itself', () => {
    expect(canSuggest('Gagua Clinic')).toBe(false);
  });

  /* Including one that happens to match what we would have suggested. */
  it('refuses even when the existing text equals the suggestion', () => {
    expect(canSuggest(transliterateGeorgian('გაგუას კლინიკა'))).toBe(false);
  });
});
