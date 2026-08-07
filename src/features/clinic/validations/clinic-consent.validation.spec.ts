import { describe, expect, it } from 'vitest';

import {
  CLINIC_CONSENT_KEYS,
  ClinicConsentSchema,
} from '@/features/clinic/validations/clinic.validation';
import {
  PATIENT_CONSENT_KEYS,
  PatientConsentSchema,
} from '@/features/patient/validations/patient.validation';

const allTicked = (keys: readonly string[]) =>
  Object.fromEntries(keys.map(key => [key, true]));

/*
  `baa` is in the clinic key list — it is a rendered checkbox — but it is not one of the mandatory
  consents these cases are about. Whether it is required depends on the clinic's country, which
  this schema cannot see, so it is enforced at the object level and covered in
  `clinic.validation.spec.ts` instead.
*/
const CLINIC_MANDATORY_KEYS = CLINIC_CONSENT_KEYS.filter(key => key !== 'baa');

/**
 * These consents are the product's legal footing, so the rules are pinned rather than trusted to
 * stay true. The cases that matter are the ways a mandatory checkbox quietly stops being
 * mandatory: a `.default()` creeping in, a key dropped from the schema, or `false` slipping past
 * a truthiness check.
 */
describe.each([
  ['clinic', ClinicConsentSchema, CLINIC_MANDATORY_KEYS, 8],
  ['patient', PatientConsentSchema, PATIENT_CONSENT_KEYS, 6],
] as const)('%s consents', (_label, schema, keys, expectedCount) => {
  it('exposes every mandatory consent in its key list', () => {
    expect(keys).toHaveLength(expectedCount);
  });

  it('accepts the payload only when every box is ticked', () => {
    expect(schema.safeParse(allTicked(keys)).success).toBe(true);
  });

  it.each(keys)('rejects the payload when %s is false', key => {
    const result = schema.safeParse({ ...allTicked(keys), [key]: false });
    expect(result.success).toBe(false);
  });

  it.each(keys)('rejects the payload when %s is missing entirely', key => {
    const payload = allTicked(keys);
    delete payload[key];
    // A `.default()` here would turn a mandatory consent into an optional one for every caller
    // that is not the browser form. Absent has to be as invalid as false.
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it('rejects a truthy non-boolean standing in for consent', () => {
    const [first] = keys;
    expect(schema.safeParse({ ...allTicked(keys), [first]: 'true' }).success).toBe(false);
    expect(schema.safeParse({ ...allTicked(keys), [first]: 1 }).success).toBe(false);
  });
});

/**
 * The BAA is the one clinic consent the schema alone does not decide, so its schema-level
 * behaviour is pinned separately: it must be rendered, must be a real boolean, and must record a
 * deliberate `false` rather than an absence when it is left alone.
 */
describe('the BAA consent', () => {
  it('is rendered with the others, so the checklist actually shows it', () => {
    expect(CLINIC_CONSENT_KEYS).toContain('baa');
    expect(Object.keys(ClinicConsentSchema.shape).sort()).toEqual([...CLINIC_CONSENT_KEYS].sort());
  });

  it('defaults to false when omitted, rather than to an absence storage has to interpret', () => {
    const result = ClinicConsentSchema.safeParse(allTicked(CLINIC_MANDATORY_KEYS));
    expect(result.success).toBe(true);
    expect(result.success && result.data.baa).toBe(false);
  });

  it('does not block this schema on its own — the country rule decides that', () => {
    const payload = { ...allTicked(CLINIC_MANDATORY_KEYS), baa: false };
    expect(ClinicConsentSchema.safeParse(payload).success).toBe(true);
  });

  it('still refuses a truthy non-boolean', () => {
    const payload = { ...allTicked(CLINIC_MANDATORY_KEYS), baa: 'true' };
    expect(ClinicConsentSchema.safeParse(payload).success).toBe(false);
  });
});
