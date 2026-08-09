'use client';

import { useCallback, useEffect, useState } from 'react';

import { RecoveryTrendView } from '@/features/recovery-log/types/recovery-log.types';
import { http } from '@/shared/lib/http';

type RecoveryTrendState = {
  trend: RecoveryTrendView | null;
  isLoading: boolean;
};

/** The clinic's chart for one patient. Read-only — a clinic never edits what a patient reported. */
export function useRecoveryTrend(patientId: string): RecoveryTrendState {
  const [trend, setTrend] = useState<RecoveryTrendView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setTrend(await http.get<RecoveryTrendView>(`/patients/${patientId}/recovery-trend`));
    } catch {
      setTrend(null);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { trend, isLoading };
}
