'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CompanyLookup, CompanyLookupResponse } from '@/features/clinic/types/clinic.types';
import { COMPANY_LOOKUP_DEBOUNCE_MS, NAPR_LOOKUP_TAX_ID } from '@/shared/const/napr.const';
import { http } from '@/shared/lib/http';
import { normaliseTaxId } from '@/shared/utils/tax-id';

type CompanyLookupState = {
  isLooking: boolean;
  /** Error code from the endpoint, translated at the field. Null while nothing has failed. */
  error: string | null;
  /** The last entity found, kept so the form can show its registration status. */
  company: CompanyLookup | null;
  /** Debounced — for `onChange`, where the value arrives one keystroke at a time. */
  lookup: (taxId: string) => void;
  /** Immediate — for `onBlur`, where the clinic has finished typing and is waiting on us. */
  lookupNow: (taxId: string) => void;
};

/**
 * Looks a clinic's legal entity up from the tax ID field and hands the result to `onFound`.
 *
 * Filling the form is the caller's job, not this hook's: the three forms that render the clinic
 * fields name them differently (`clinicName` on sign-up, `name` elsewhere), so the hook reports
 * what it found and the component decides where it goes.
 *
 * Nothing is requested until the value is exactly nine digits. Below that the clinic is still
 * typing, and above it the value is something the registry does not answer on — an 11-digit
 * personal number, an EU VAT number — so there is nothing to ask about.
 */
export function useCompanyLookup(onFound: (company: CompanyLookup) => void): CompanyLookupState {
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyLookup | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
    The last code we actually sent. Guards the common double-fire: the debounce elapses while the
    clinic is still in the field, then blur immediately asks for the same code again.
  */
  const lastQueriedRef = useRef<string | null>(null);
  /*
    Monotonic request id. `http` has no abort, so staleness is handled on the way back instead —
    a response is only applied if no newer request has started since. Without it a slow lookup for
    a code the clinic has already corrected lands last and overwrites the right answer.
  */
  const requestIdRef = useRef(0);

  /*
    A callback ref rather than a dependency: `onFound` is written inline at the call site and is a
    new function every render, so depending on it would rebuild the debounced `lookup` on every
    keystroke and cancel the timer it had just set.
  */
  const onFoundRef = useRef(onFound);
  useEffect(() => {
    onFoundRef.current = onFound;
  });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const run = useCallback(async (taxId: string) => {
    lastQueriedRef.current = taxId;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setIsLooking(true);
    setError(null);

    try {
      const response = await http.get<CompanyLookupResponse>('/company/lookup', {
        params: { taxId },
      });
      if (requestId !== requestIdRef.current) return;

      setCompany(response.data);
      onFoundRef.current(response.data);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;

      /*
        A failed lookup must not clear a company the clinic already matched, and must not be
        remembered as "asked and answered" — otherwise a registry blip on a code that would
        succeed on retry is never retried, because blur sees it in `lastQueried` and skips.
      */
      lastQueriedRef.current = null;
      setCompany(null);
      setError(caught instanceof Error ? caught.message : 'REGISTRY_UNAVAILABLE');
    } finally {
      if (requestId === requestIdRef.current) setIsLooking(false);
    }
  }, []);

  /**
   * Decides whether `value` is worth asking about, and returns the code to send if so.
   *
   * Also resets the panel when it is not: a clinic that corrects a wrong code down to eight digits
   * should not still be looking at the error, or at the name, from the code it replaced.
   */
  const prepare = useCallback((value: string): string | null => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const taxId = normaliseTaxId(value);
    if (!NAPR_LOOKUP_TAX_ID.test(taxId)) {
      requestIdRef.current += 1;
      lastQueriedRef.current = null;
      setIsLooking(false);
      setError(null);
      setCompany(null);
      return null;
    }

    return taxId === lastQueriedRef.current ? null : taxId;
  }, []);

  const lookup = useCallback(
    (value: string) => {
      const taxId = prepare(value);
      if (!taxId) return;

      timerRef.current = setTimeout(() => void run(taxId), COMPANY_LOOKUP_DEBOUNCE_MS);
    },
    [prepare, run]
  );

  const lookupNow = useCallback(
    (value: string) => {
      const taxId = prepare(value);
      if (!taxId) return;

      void run(taxId);
    },
    [prepare, run]
  );

  return { isLooking, error, company, lookup, lookupNow };
}
