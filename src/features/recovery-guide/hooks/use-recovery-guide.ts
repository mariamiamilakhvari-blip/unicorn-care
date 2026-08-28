'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

import { PatientGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { http } from '@/shared/lib/http';

/**
 * Why there is no guide to show.
 *
 * `missing` — nobody has written one for this procedure, in any language.
 * `untranslated` — one exists, in the language the patient did not choose.
 *
 * Kept apart because the patient is told which, and the two sentences are not interchangeable:
 * "your clinic has not added guidance yet" is untrue for a clinic that wrote it in Georgian.
 */
type GuideAbsence = 'missing' | 'untranslated';

type RecoveryGuideState = {
  guide: PatientGuideView | null;
  /** Set only when `guide` is null, and never both. */
  absence: GuideAbsence | null;
  isLoading: boolean;
};

/*
  Reading only. Filing a report moved to `useConcernReport` when the portal's two escalation
  widgets became one: this hook's `reportedAt` latched for the session, which is right for "the
  guide has loaded" and wrong for "the patient has told us something" — a recovery is days long
  and the second symptom deserves the same box as the first.
*/

export function useRecoveryGuide(): RecoveryGuideState {
  const [guide, setGuide] = useState<PatientGuideView | null>(null);
  const [absence, setAbsence] = useState<GuideAbsence | null>(null);
  /*
    The language the patient is reading in, which the request has to carry: the API defaults to
    the locale on their record, so without this the guide ignored the portal's language toggle.
  */
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    http
      .get<PatientGuideView>(`/patient-portal/recovery-guide?locale=${locale}`)
      // No guide for this procedure type is normal, not an error the patient should see.
      .then(result => {
        if (cancelled) return;
        setGuide(result);
        setAbsence(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setGuide(null);
        /*
          `http` puts the API's error code on the Error's message, so the two kinds of "nothing to
          show" arrive here distinguishable. Anything else — a network drop, a 500 — is treated as
          `missing`: the panel then says the guidance is not there, which is what the patient can
          see for themselves, rather than claiming a translation exists on no evidence.
        */
        const code = caught instanceof Error ? caught.message : '';
        setAbsence(code === 'NOT_TRANSLATED' ? 'untranslated' : 'missing');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  return { guide, absence, isLoading };
}
