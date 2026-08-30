import { describe, expect, it } from 'vitest';

import { CreatePatientSchema } from '@/features/patient/validations/patient.validation';
import { MAX_PATIENT_AGE, MIN_PATIENT_AGE } from '@/shared/const/patient.const';

const consents = {
  personalData: true,
  healthData: true,
  reminders: true,
  portalAccess: true,
  informed: true,
  accurate: true,
  corrections: true,
};

const base = { firstName: 'Nino', lastName: 'Beridze', consents };

const parse = (age: unknown) => CreatePatientSchema.safeParse({ ...base, age });

describe('CreatePatientSchema — age', () => {
  it('defaults to null when the clinic never asked', () => {
    const result = CreatePatientSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.success && result.data.age).toBeNull();
  });

  /*
    Zero is the case this field is most likely to get wrong. A newborn has an age, and every
    shortcut that treats the number as falsy — a truthy render guard, a `||` default — silently
    turns that patient into one with no age recorded.
  */
  it.each([MIN_PATIENT_AGE, 1, 35, MAX_PATIENT_AGE])('accepts %i', age => {
    const result = parse(age);

    expect(result.success).toBe(true);
    expect(result.success && result.data.age).toBe(age);
  });

  it.each([
    ['a negative age', -1],
    ['an age past the ceiling', MAX_PATIENT_AGE + 1],
    ['a fraction, which is a mis-typed field rather than a measurement', 35.5],
    ['a birth year typed into the age box', 1990],
  ])('rejects %s', (_label, age) => {
    expect(parse(age).success).toBe(false);
  });

  /*
    An explicit null must stay null. `z.coerce.number()` reads it as 0, which would file every
    patient the clinic skipped this field for as a newborn — hence the null branch first in the
    union rather than a coercion that happens to be tolerable.
  */
  it('keeps an explicit null out of the coercion path', () => {
    const result = parse(null);

    expect(result.success).toBe(true);
    expect(result.success && result.data.age).toBeNull();
  });
});
