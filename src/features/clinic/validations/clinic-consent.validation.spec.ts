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
  Every clinic consent is mandatory now, including the Data Processing Agreement. It used to be
  filtered out of this list because it was a US-only Business Associate Agreement enforced at the
  object level against the clinic's country; under the Law of Georgia on Personal Data Protection
  every controller engaging a processor needs one, so there is nothing left to exclude.
*/
const CLINIC_MANDATORY_KEYS = CLINIC_CONSENT_KEYS;

/**
 * These consents are the product's legal footing, so the rules are pinned rather than trusted to
 * stay true. The cases that matter are the ways a mandatory checkbox quietly stops being
 * mandatory: a `.default()` creeping in, a key dropped from the schema, or `false` slipping past
 * a truthiness check.
 */
describe.each([
  ['clinic', ClinicConsentSchema, CLINIC_MANDATORY_KEYS, 9],
  ['patient', PatientConsentSchema, PATIENT_CONSENT_KEYS, 7],
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
 * The Data Processing Agreement used to be the one clinic consent the schema alone did not
 * decide — it was a US-only Business Associate Agreement, enforced against the clinic's country
 * at object level. It is now mandatory like the rest, and these cases pin the move: it is still
 * rendered with the others, and neither an omission nor a refusal gets past the schema.
 */
describe('the Data Processing Agreement consent', () => {
  it('is rendered with the others, so the checklist actually shows it', () => {
    expect(CLINIC_CONSENT_KEYS).toContain('dataProcessing');
    expect(Object.keys(ClinicConsentSchema.shape).sort()).toEqual([...CLINIC_CONSENT_KEYS].sort());
  });

  it('rejects an omitted Data Processing Agreement rather than defaulting it to false', () => {
    // It carried a `.default(false)` while it was a US-only Business Associate Agreement. Now that
    // every controller needs a written processor agreement, a default would be the one way a
    // clinic could be created without one.
    const withoutDpa = allTicked(CLINIC_MANDATORY_KEYS.filter(key => key !== 'dataProcessing'));
    expect(ClinicConsentSchema.safeParse(withoutDpa).success).toBe(false);
  });

  it('rejects a refused Data Processing Agreement — it is mandatory in every country', () => {
    const payload = { ...allTicked(CLINIC_MANDATORY_KEYS), dataProcessing: false };
    expect(ClinicConsentSchema.safeParse(payload).success).toBe(false);
  });

  it('still refuses a truthy non-boolean', () => {
    const payload = { ...allTicked(CLINIC_MANDATORY_KEYS), dataProcessing: 'true' };
    expect(ClinicConsentSchema.safeParse(payload).success).toBe(false);
  });
});
