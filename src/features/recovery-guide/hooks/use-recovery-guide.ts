'use client';

import { useCallback, useEffect, useState } from 'react';

import { RecoveryGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { CreateSymptomReportType } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { http } from '@/shared/lib/http';

type RecoveryGuideState = {
  guide: RecoveryGuideView | null;
  isLoading: boolean;
  isReporting: boolean;
  reportedAt: number | null;
  error: string | null;
  report: (input: CreateSymptomReportType) => Promise<void>;
};

export function useRecoveryGuide(): RecoveryGuideState {
  const [guide, setGuide] = useState<RecoveryGuideView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [reportedAt, setReportedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    http
      .get<RecoveryGuideView>('/patient-portal/recovery-guide')
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
  }, []);

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
