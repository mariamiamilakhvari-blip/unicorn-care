import { describe, expect, it } from 'vitest';

import { DEFAULT_TIMEZONE, effectiveTimeZone, isValidTimeZone } from '@/shared/const/timezone.const';

/**
 * Three callers depend on this agreeing with itself: the portal read, the reminder generator and
 * the email builders. If they ever resolve a patient's zone differently, the times on the screen
 * stop matching the times in the inbox and neither is obviously the wrong one.
 */
describe('effectiveTimeZone', () => {
  it('prefers the patient’s own zone', () => {
    expect(effectiveTimeZone('Europe/Amsterdam', 'Asia/Tbilisi')).toBe('Europe/Amsterdam');
  });

  it('inherits the clinic’s until the portal has learned one', () => {
    expect(effectiveTimeZone('', 'Asia/Tbilisi')).toBe('Asia/Tbilisi');
  });

  /**
   * Both fields could be written before either was validated. Falling through to the default keeps
   * a page readable rather than throwing inside `Intl` on the view a patient opens every morning.
   */
  it('falls through to the default when neither value resolves', () => {
    expect(effectiveTimeZone('Mars/Olympus_Mons', 'Tbilisi')).toBe(DEFAULT_TIMEZONE);
  });

  it('ignores an unusable patient zone rather than preferring it', () => {
    expect(effectiveTimeZone('Tbilisi', 'Europe/Berlin')).toBe('Europe/Berlin');
  });
});

describe('isValidTimeZone', () => {
  it('accepts an IANA name', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });

  it('rejects a city that is not a zone', () => {
    expect(isValidTimeZone('Tbilisi')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidTimeZone('')).toBe(false);
  });
});
