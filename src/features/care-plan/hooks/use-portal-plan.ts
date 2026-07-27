'use client';

import { useCallback, useEffect, useState } from 'react';

import { PortalPlanView } from '@/features/care-plan/types/portal.types';
import { http } from '@/shared/lib/http';

type PortalPlanState = {
  plan: PortalPlanView | null;
  isLoading: boolean;
  hasError: boolean;
  reload: () => Promise<void>;
  complete: (occurrenceId: string, outcome: 'done' | 'skipped') => Promise<void>;
};

export function usePortalPlan(): PortalPlanState {
  const [plan, setPlan] = useState<PortalPlanView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setPlan(await http.get<PortalPlanView>('/patient-portal/plan'));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Refetches rather than patching local state: the plan is dosing data, so the server's copy is
   * the only one worth rendering.
   */
  const complete = useCallback(
    async (occurrenceId: string, outcome: 'done' | 'skipped') => {
      await http.post(`/patient-portal/occurrences/${occurrenceId}/${outcome === 'done' ? 'complete' : 'skip'}`);
      await reload();
    },
    [reload]
  );

  return { plan, isLoading, hasError, reload, complete };
}
