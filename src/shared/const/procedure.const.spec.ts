import { describe, expect, it } from 'vitest';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import { seedFamilyFor } from '@/shared/const/recovery-guide-seed.const';

/**
 * The catalogue a clinic picks from, and the one thing about it that is not cosmetic: `key` is
 * written onto every procedure document and read back for the rest of that patient's recovery.
 * A label can be corrected any day; a key cannot be edited without rewriting stored rows.
 */
describe('the procedure catalogue', () => {
  /*
    The catch-all, and the only entry that is not a procedure. A clinic doing something the list
    does not name needs somewhere to put it — without one the nearest wrong option gets picked,
    and the record then says the patient had a procedure they did not have.
  */
  it('offers `other` as the last option', () => {
    expect(PROCEDURE_TYPES.at(-1)?.key).toBe('other');
  });

  it('has no duplicate keys', () => {
    const keys = PROCEDURE_TYPES.map(type => type.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /* Keys are stored, so they stay ASCII snake_case whatever language the label is written in. */
  it.each(PROCEDURE_TYPES.map(type => type.key))('%s is a stable stored key', key => {
    expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it.each(PROCEDURE_TYPES)('$key is labelled in both languages', type => {
    expect(type.ka.trim()).not.toBe('');
    expect(type.en.trim()).not.toBe('');
  });

  it('every entry resolves to a recovery guide family', () => {
    for (const type of PROCEDURE_TYPES) {
      expect(seedFamilyFor(type.key)).toBeTruthy();
    }
  });
});

/**
 * Keys kept from the previous catalogue because procedures already carry them.
 *
 * These were not preserved for tidiness. `manipulationType` is a stored string, so dropping one of
 * these keys turns a saved procedure into a row that renders its own key as its name and fails
 * validation the next time anyone edits it. Each is here because the new catalogue contains the
 * same procedure under a new label, not merely a similar one.
 */
describe('keys carried over from the previous catalogue', () => {
  const CARRIED_OVER = [
    'rhinoplasty',
    'liposuction',
    'abdominoplasty',
    'blepharoplasty',
    'facelift',
    'gynecomastia_surgery',
    'dermal_filler',
    'chemical_peel',
    'laser_resurfacing',
    'thread_lift',
    'botox_injection',
  ];

  it.each(CARRIED_OVER)('%s is still selectable', key => {
    expect(PROCEDURE_TYPES.some(type => type.key === key)).toBe(true);
  });

  /* The drafts written for these two are attached by key, so the key surviving is what keeps them. */
  it('keeps rhinoplasty and liposuction on their own drafts', () => {
    expect(seedFamilyFor('rhinoplasty')).toBe('rhinoplasty');
    expect(seedFamilyFor('liposuction')).toBe('bodyContouring');
  });
});
