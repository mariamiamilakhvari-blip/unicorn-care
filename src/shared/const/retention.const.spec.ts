import { describe, expect, it } from 'vitest';

import {
  CLINICAL_RECORD_RETENTION_YEARS,
  CONSENT_RECORD_RETENTION_YEARS,
  ERASABLE_PATIENT_FIELDS,
  isWithinClinicalRetention,
} from '@/shared/const/retention.const';

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-16T00:00:00.000Z');

const yearsAgo = (years: number) => new Date(NOW.getTime() - years * YEAR_MS);

/**
 * These constants are the line between two statutes that pull in opposite directions, so they are
 * pinned rather than trusted to stay right. The failure they exist to prevent is silent: a
 * shortened window, or a clinically load-bearing field slipping into the erasable list, breaks a
 * legal obligation without breaking anything a test would otherwise notice.
 */
describe('clinical retention', () => {
  it('holds a record inside the mandatory window', () => {
    expect(isWithinClinicalRetention(yearsAgo(1), NOW)).toBe(true);
    expect(isWithinClinicalRetention(yearsAgo(CLINICAL_RECORD_RETENTION_YEARS - 1), NOW)).toBe(true);
  });

  it('releases it only once the window has fully elapsed', () => {
    expect(isWithinClinicalRetention(yearsAgo(CLINICAL_RECORD_RETENTION_YEARS + 1), NOW)).toBe(
      false
    );
  });

  it('does not let leap years shorten the window', () => {
    // Counted in mean Julian years. Using 365 would retire a record early once every four years,
    // which is the kind of error nobody notices until a regulator asks for the record.
    const justInside = new Date(NOW.getTime() - (CLINICAL_RECORD_RETENTION_YEARS * YEAR_MS - 1));
    expect(isWithinClinicalRetention(justInside, NOW)).toBe(true);
  });

  it('keeps consent evidence at least as long as the processing it justified', () => {
    // A consent that expires out of the log before the record it authorised cannot demonstrate
    // that the processing was ever lawful.
    expect(CONSENT_RECORD_RETENTION_YEARS).toBeGreaterThanOrEqual(CLINICAL_RECORD_RETENTION_YEARS);
  });
});

describe('erasable patient fields', () => {
  it('covers the identifying and contact data an erasure request must clear', () => {
    expect([...ERASABLE_PATIENT_FIELDS]).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'phone', 'email', 'notes'])
    );
  });

  it.each(['allergies', 'age', 'sex'])(
    'never erases %s — the retained clinical record is unreadable or unsafe without it',
    field => {
      expect([...ERASABLE_PATIENT_FIELDS]).not.toContain(field);
    }
  );
});
