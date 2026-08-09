'use client';

import { useCallback, useEffect, useState } from 'react';

import { PatientReachability } from '@/features/patient/types/patient.types';
import { http } from '@/shared/lib/http';

type ReachabilityState = {
  reachability: PatientReachability | null;
  isLoading: boolean;
};

/**
 * Whether reminders can reach this patient.
 *
 * Fetched separately from the patient record rather than folded into it: the answer depends on
 * push subscriptions and suppression state, and the patient list would pay for that lookup on
 * every row to show a badge on one.
 */
export function useReachability(patientId: string): ReachabilityState {
  const [reachability, setReachability] = useState<PatientReachability | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReachability(
        await http.get<PatientReachability>(`/patients/${patientId}/reachability`)
      );
    } catch {
      // Silent: a badge that fails to load must not imply the patient is unreachable.
      setReachability(null);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reachability, isLoading };
}
