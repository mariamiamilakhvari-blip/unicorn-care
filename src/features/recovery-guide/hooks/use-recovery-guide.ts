'use client';

import { useLocale } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { PatientGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { CreateSymptomReportType } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { http } from '@/shared/lib/http';

type RecoveryGuideState = {
  guide: PatientGuideView | null;
  isLoading: boolean;
  isReporting: boolean;
  reportedAt: number | null;
  error: string | null;
  report: (input: CreateSymptomReportType) => Promise<void>;
};

export function useRecoveryGuide(): RecoveryGuideState {
  const [guide, setGuide] = useState<PatientGuideView | null>(null);
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
        if (!cancelled) setGuide(result);
      })
      .catch(() => {
        if (!cancelled) setGuide(null);
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

  return { guide, isLoading, isReporting, reportedAt, error, report };
}
