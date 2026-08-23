import { describe, expect, it } from 'vitest';

import {
  confirmationMatches,
  normalizeConfirmationName,
} from '@/shared/utils/confirmation-name';

describe('normalizeConfirmationName', () => {
  it('trims the ends', () => {
    expect(normalizeConfirmationName('  tamar amilakhvari  ')).toBe('tamar amilakhvari');
  });

  it('collapses an internal run of whitespace', () => {
    expect(normalizeConfirmationName('tamar  amilakhvari')).toBe('tamar amilakhvari');
  });

  it('collapses tabs and newlines a paste can carry', () => {
    expect(normalizeConfirmationName('tamar\t\namilakhvari')).toBe('tamar amilakhvari');
  });

  it('leaves case alone', () => {
    expect(normalizeConfirmationName('Tamar Amilakhvari')).toBe('Tamar Amilakhvari');
  });
});

describe('confirmationMatches', () => {
  /*
    The case this was written for: a stored `firstName` with a trailing space renders identically
    to one without, so the typed name has to match what the screen showed rather than what the
    record happens to hold.
  */
  it('matches a visually identical name across a double space in the record', () => {
    expect(confirmationMatches('tamar amilakhvari', 'tamar  amilakhvari')).toBe(true);
  });

  it('matches when the typed name carries the stray whitespace instead', () => {
    expect(confirmationMatches(' tamar  amilakhvari ', 'tamar amilakhvari')).toBe(true);
  });

  it('still refuses a different name', () => {
    expect(confirmationMatches('tamar amilakhvar', 'tamar amilakhvari')).toBe(false);
  });

  it('still refuses a different case', () => {
    expect(confirmationMatches('Tamar Amilakhvari', 'tamar amilakhvari')).toBe(false);
  });
});
