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

/**
 * These consents are the product's legal footing, so the rules are pinned rather than trusted to
 * stay true. The cases that matter are the ways a mandatory checkbox quietly stops being
 * mandatory: a `.default()` creeping in, a key dropped from the schema, or `false` slipping past
 * a truthiness check.
 */
describe.each([
  ['clinic', ClinicConsentSchema, CLINIC_CONSENT_KEYS, 8],
  ['patient', PatientConsentSchema, PATIENT_CONSENT_KEYS, 6],
] as const)('%s consents', (_label, schema, keys, expectedCount) => {
  it('exposes every consent in its key list', () => {
    expect(keys).toHaveLength(expectedCount);
    expect(Object.keys(schema.shape).sort()).toEqual([...keys].sort());
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
