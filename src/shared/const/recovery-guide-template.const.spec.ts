import { describe, expect, it } from 'vitest';

import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import { seedFamilyFor } from '@/shared/const/recovery-guide-seed.const';
import {
  hasProcedureSpecificTemplate,
  recoveryGuideTemplate,
} from '@/shared/const/recovery-guide-template.const';

/**
 * The three drafts a clinician supplied for named operations. Each assertion below pins a finding
 * to the procedure it was written for — a template that silently reverted to the generic baseline
 * would still render, still read as advice, and say nothing about the operation in question.
 */
describe('procedure-specific templates', () => {
  it('gives rhinoplasty its own nasal findings', () => {
    const body = recoveryGuideTemplate('en', 'rhinoplasty');
    const expected = body.expected.map(item => item.title).join(' | ');
    const warning = body.warning.map(item => item.title).join(' | ');

    expect(expected).toContain('nasal congestion');
    expect(warning).toContain('nosebleed');
    expect(hasProcedureSpecificTemplate('rhinoplasty')).toBe(true);
  });

  it.each(['liposuction', 'abdominoplasty'])('gives %s the contouring draft', key => {
    const body = recoveryGuideTemplate('en', key);

    expect(body.warning.map(item => item.title).join(' | ')).toContain('shortness of breath');
    expect(body.expected.map(item => item.title).join(' | ')).toContain('bruising');
    expect(hasProcedureSpecificTemplate(key)).toBe(true);
  });

  it('gives breast augmentation its own findings', () => {
    const body = recoveryGuideTemplate('en', 'breast_augmentation');

    expect(body.expected.map(item => item.title).join(' | ')).toContain('Tightness');
    expect(body.warning.map(item => item.title).join(' | ')).toContain('One side suddenly');
    expect(hasProcedureSpecificTemplate('breast_augmentation')).toBe(true);
  });

  /* The Georgian half must carry the same findings, not a translation of the generic baseline. */
  it.each(['rhinoplasty', 'liposuction', 'abdominoplasty', 'breast_augmentation'])(
    '%s differs from the surgical baseline in Georgian too',
    key => {
      const specific = recoveryGuideTemplate('ka', key);
      const baseline = recoveryGuideTemplate('ka', 'facelift');

      expect(specific.expected.map(item => item.title)).not.toEqual(
        baseline.expected.map(item => item.title)
      );
    }
  );
});

/**
 * The fallback is the feature, not the gap. A clinic that entered a procedure nobody mapped still
 * has to see a guide, and the surgical baseline is the cautious one.
 */
describe('the general fallback', () => {
  it.each(['other', 'something_typed_by_hand', ''])(
    'falls back to the general surgical draft for %s',
    key => {
      const body = recoveryGuideTemplate('en', key);

      expect(seedFamilyFor(key)).toBe('surgical');
      expect(body.expected.length).toBeGreaterThan(0);
      expect(body.warning.some(item => item.severity === 'emergency')).toBe(true);
      expect(hasProcedureSpecificTemplate(key)).toBe(false);
    }
  );

  /* Named in the request but never given content, so they must keep their baselines. */
  it('leaves blepharoplasty on the surgical baseline', () => {
    expect(hasProcedureSpecificTemplate('blepharoplasty')).toBe(false);
  });

  it.each(['botox_injection', 'dermal_filler'])('leaves %s on the non-surgical baseline', key => {
    expect(seedFamilyFor(key)).toBe('nonSurgical');
    expect(hasProcedureSpecificTemplate(key)).toBe(false);
  });
});

describe('every procedure resolves to a usable draft', () => {
  it.each(PROCEDURE_TYPES.flatMap(type => [
    [type.key, 'en'] as const,
    [type.key, 'ka'] as const,
  ]))('%s has content in %s', (key, locale) => {
    const body = recoveryGuideTemplate(locale, key);

    expect(body.expected.length).toBeGreaterThan(0);
    expect(body.warning.length).toBeGreaterThan(0);
  });
});

/**
 * A baseline draft is shown for procedures nobody wrote one for, so it must not claim to know
 * where the clinic worked. "Redness on the forehead" is right for one Botox patient and wrong for
 * the next, and the patient reading it cannot tell which — they see their clinic's guidance saying
 * something untrue about their own treatment.
 *
 * The rule applies to `expected` and deliberately not to `warning`. Every body part left in the
 * warnings is a *systemic* sign rather than a claim about the treated zone: lips and throat are
 * anaphylaxis, one calf is a clot, vision is a vascular occlusion, chest is an embolism. Rewriting
 * those as "the treated area" would not neutralise them, it would delete them.
 */
describe('baseline drafts name no anatomy', () => {
  const ANATOMY = [
    // English
    'forehead', 'lip', 'eyelid', 'nose', 'nasal', 'breast', 'cheek', 'chin', 'jaw',
    'abdomen', 'thigh', 'buttock', 'scalp', 'nostril',
    // Georgian
    'შუბლ', 'ტუჩ', 'ქუთუთო', 'ცხვირ', 'მკერდ', 'ლოყ', 'ნიკაპ', 'მუცელ', 'ბარძაყ', 'თხემ',
  ];

  it.each(['en', 'ka'] as const)('%s baselines describe only the treated area', locale => {
    for (const key of ['other', 'facelift', 'botox_injection', 'chemical_peel']) {
      const text = recoveryGuideTemplate(locale, key)
        .expected.map(item => `${item.title} ${item.description}`)
        .join(' ')
        .toLowerCase();

      for (const word of ANATOMY) expect(text).not.toContain(word);
    }
  });

  /* The exception, and the only one: a procedure that is one anatomical area by definition. */
  it('lets a procedure-specific draft name the part it is about', () => {
    const rhino = recoveryGuideTemplate('en', 'rhinoplasty')
      .expected.map(item => `${item.title} ${item.description}`)
      .join(' ')
      .toLowerCase();

    expect(rhino).toContain('nasal');
  });
});
