import { describe, expect, it } from 'vitest';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import {
  SEED_FAMILIES,
  SEED_PROCEDURE_KEYS,
  seedFamilyFor,
  SeedGuideBody,
} from '@/shared/const/recovery-guide-seed.const';
import { RECOVERY_GUIDE_TEMPLATES } from '@/shared/const/recovery-guide-template.const';
import { WARNING_SEVERITIES } from '@/shared/const/recovery.const';

describe('every procedure type is covered', () => {
  it('seeds one draft per procedure type', () => {
    expect(SEED_PROCEDURE_KEYS).toHaveLength(PROCEDURE_TYPES.length);
  });

  it.each(PROCEDURE_TYPES.map(type => type.key))('maps %s to a family', key => {
    expect(SEED_FAMILIES).toContain(seedFamilyFor(key));
  });

  /**
   * A procedure type nobody classified must not fall through to nothing. The surgical baseline is
   * the more cautious of the two, so an unknown key gets the guidance that says more about
   * bleeding and infection rather than less.
   */
  it('falls back to the cautious family for an unrecognised key', () => {
    expect(seedFamilyFor('something_new_next_year')).toBe('surgical');
  });
});

/**
 * Retiring a key from the dropdown does not retire it from the database. Procedures created before
 * the catalogue changed still carry these, and they still have to resolve to the draft they were
 * resolving to yesterday.
 */
describe('procedures stored under a retired key', () => {
  it.each(['breast_lift', 'breast_reduction', 'otoplasty', 'brazilian_butt_lift', 'hair_transplant'])(
    '%s still resolves to the surgical baseline',
    key => {
      expect(seedFamilyFor(key)).toBe('surgical');
    }
  );

  /*
    The one retired key where the fallback would be a real loss: a clinician wrote this draft for
    breast augmentation, and dropping to the generic surgical baseline would swap reviewed content
    for a general one under patients who are already mid-recovery.
  */
  it('keeps breast augmentation on the draft written for it', () => {
    expect(seedFamilyFor('breast_augmentation')).toBe('breastAugmentation');
  });
});

/**
 * The two languages must stay item for item identical. A patient reading Georgian must not get
 * fewer warnings, milder severities or narrower day windows than one reading English — that is a
 * clinical difference produced by a translation gap, and it would be invisible.
 */
describe('the Georgian and English drafts stay parallel', () => {
  it.each(SEED_FAMILIES)('%s has the same number of items in both languages', family => {
    expect(RECOVERY_GUIDE_TEMPLATES.ka[family].expected).toHaveLength(
      RECOVERY_GUIDE_TEMPLATES.en[family].expected.length
    );
    expect(RECOVERY_GUIDE_TEMPLATES.ka[family].warning).toHaveLength(
      RECOVERY_GUIDE_TEMPLATES.en[family].warning.length
    );
  });

  it.each(SEED_FAMILIES)('%s carries the same severities in the same order', family => {
    const ka = RECOVERY_GUIDE_TEMPLATES.ka[family].warning.map(item => item.severity);
    const en = RECOVERY_GUIDE_TEMPLATES.en[family].warning.map(item => item.severity);

    expect(ka).toEqual(en);
  });

  it.each(SEED_FAMILIES)('%s carries the same day windows', family => {
    const days = (body: SeedGuideBody) => [
      ...body.expected.map(item => [item.fromDay, item.toDay]),
      ...body.warning.map(item => [item.fromDay, item.toDay]),
    ];

    expect(days(RECOVERY_GUIDE_TEMPLATES.ka[family])).toEqual(days(RECOVERY_GUIDE_TEMPLATES.en[family]));
  });

  it.each(SEED_FAMILIES)('%s is written in Georgian, not left as English', family => {
    // Guards against a copy-paste that leaves the English text sitting in the Georgian file.
    const titles = RECOVERY_GUIDE_TEMPLATES.ka[family].expected.map(item => item.title).join(' ');

    expect(titles).toMatch(/[Ⴀ-ჿ]/);
  });
});

describe('the drafts are well formed', () => {
  const bodies = SEED_FAMILIES.flatMap(family => [
    RECOVERY_GUIDE_TEMPLATES.ka[family],
    RECOVERY_GUIDE_TEMPLATES.en[family],
  ]);

  it('has content in every family', () => {
    for (const body of bodies) {
      expect(body.expected.length).toBeGreaterThan(0);
      expect(body.warning.length).toBeGreaterThan(0);
    }
  });

  it('uses only known severities', () => {
    for (const body of bodies) {
      for (const item of body.warning) expect(WARNING_SEVERITIES).toContain(item.severity);
    }
  });

  it('never ends a window before it starts', () => {
    for (const body of bodies) {
      for (const item of [...body.expected, ...body.warning]) {
        expect(item.toDay).toBeGreaterThanOrEqual(item.fromDay);
      }
    }
  });

  it('gives every item a title and a non-empty description', () => {
    for (const body of bodies) {
      for (const item of [...body.expected, ...body.warning]) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The one thing a generic draft must always carry: the emergency cases that are true whatever
   * the procedure was. A baseline with no `emergency` item would read as reassurance.
   */
  it.each(SEED_FAMILIES)('%s names at least one emergency', family => {
    for (const body of [RECOVERY_GUIDE_TEMPLATES.ka[family], RECOVERY_GUIDE_TEMPLATES.en[family]]) {
      expect(body.warning.some(item => item.severity === 'emergency')).toBe(true);
    }
  });
});
