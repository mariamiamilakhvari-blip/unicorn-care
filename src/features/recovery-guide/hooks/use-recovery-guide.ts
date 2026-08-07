'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { PatientGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { CreateSymptomReportType } from '@/features/recovery-guide/validations/recovery-guide.validation';
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
  isReporting: boolean;
  reportedAt: number | null;
  error: string | null;
  report: (input: CreateSymptomReportType) => Promise<void>;
};

export function useRecoveryGuide(): RecoveryGuideState {
  const [guide, setGuide] = useState<PatientGuideView | null>(null);
  const [absence, setAbsence] = useState<GuideAbsence | null>(null);
  /*
    The language the patient is reading in, which the request has to carry: the API defaults to
    the locale on their record, so without this the guide ignored the portal's language toggle.
  */
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [reportedAt, setReportedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const report = useCallback(async (input: CreateSymptomReportType) => {
    setIsReporting(true);
    setError(null);
    try {
      await http.post('/patient-portal/symptom-reports', input);
      setReportedAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsReporting(false);
    }
  }, []);

  return { guide, absence, isLoading, isReporting, reportedAt, error, report };
}
