'use client';

import { useEffect, useRef } from 'react';
import { UseFormGetValues, UseFormSetValue } from 'react-hook-form';

import { ClinicProfileFormType } from '@/features/clinic/validations/clinic.validation';
import { canSuggest, transliterateGeorgian } from '@/shared/utils/transliterate';

/** Each Georgian field and the English one it offers to fill. */
const PAIRS = [
  { source: 'name', target: 'nameEn' },
  { source: 'addressLine', target: 'addressLineEn' },
] as const;

type EnglishPrefillArgs = {
  name: string;
  addressLine: string;
  getValues: UseFormGetValues<ClinicProfileFormType>;
  setValue: UseFormSetValue<ClinicProfileFormType>;
};

/**
 * Offers a Latin spelling of the clinic's name and address as they type the Georgian one.
 *
 * The problem it solves is an empty field, not an unwritten translation. `nameEn` is optional and
 * most clinics never filled it, so English-language patients got a Georgian name in the subject
 * line of every email — technically the documented fallback, and still the wrong thing to read.
 * Typing it out is a small task that nobody does; being handed it and asked to check is one they
 * will.
 *
 * Suggestions only ever land in an empty field. A clinic that typed its own English name has
 * already answered this, and rewriting it on every keystroke in the Georgian field would be the
 * feature destroying their work — see `canSuggest`.
 *
 * It fires on change and deliberately not on mount. Opening the settings page must not silently
 * dirty a saved profile with text nobody asked for; a clinic that edits its Georgian name is
 * asking, which is the moment the offer belongs.
 *
 * The result is a suggestion in a visible, editable field, never a value written behind anyone's
 * back. That is what keeps it inside the rule it looks like it might break: the platform does not
 * decide what a clinic is called in English. It proposes a spelling, and the clinic says.
 */
export function useEnglishPrefill({
  name,
  addressLine,
  getValues,
  setValue,
}: EnglishPrefillArgs): void {
  /*
    Seeded with the values the form opened on, so the first run compares equal and suggests
    nothing. Without it, every clinic with an empty `nameEn` would find its form dirty the moment
    the page rendered.
  */
  const previous = useRef<Record<string, string>>({ name, addressLine });

  useEffect(() => {
    const current: Record<string, string> = { name, addressLine };
    const before = previous.current;
    previous.current = current;

    for (const { source, target } of PAIRS) {
      if (current[source] === before[source]) continue;
      if (!canSuggest(getValues(target) ?? '')) continue;

      const suggestion = transliterateGeorgian(current[source] ?? '');
      // Clearing the Georgian field suggests nothing rather than blanking the English one, which
      // would read as the form deleting text the clinic could still want.
      if (!suggestion) continue;

      setValue(target, suggestion, { shouldDirty: true });
    }
  }, [name, addressLine, getValues, setValue]);
}
