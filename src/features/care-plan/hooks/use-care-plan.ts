'use client';

import { useCallback, useEffect, useState } from 'react';

import { CarePlanFormType } from '@/features/care-plan/types/care-plan-form.types';
import { StoredCarePlan } from '@/features/care-plan/types/care-plan-mapper';
import { http } from '@/shared/lib/http';

type CarePlanState = {
  plan: StoredCarePlan | null;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  savedAt: number | null;
  /** Resolves true when the plan reached the server, false when it was rejected. */
  save: (procedureId: string, patientId: string, values: CarePlanFormType) => Promise<boolean>;
  activate: () => Promise<void>;
};

/**
 * Loads the plan attached to a procedure, if one exists, and saves changes back to it.
 *
 * Fetching on mount is what makes the builder survive a reload: previously the hook started with
 * `null` every time, so a saved plan was invisible and the next submit tried to create a second
 * one for the same procedure.
 */
export function useCarePlan(procedureId: string | null): CarePlanState {
  const [plan, setPlan] = useState<StoredCarePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!procedureId) {
      setPlan(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    http
      .get<StoredCarePlan>('/care-plans', { params: { procedureId } })
      .then(existing => {
        if (!cancelled) setPlan(existing);
      })
      // A procedure with no plan yet is the normal first-visit case, not an error worth showing.
      .catch(() => {
        if (!cancelled) setPlan(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [procedureId]);

  const save = useCallback(
    async (procedure: string, patientId: string, values: CarePlanFormType) => {
      setIsPending(true);
      setError(null);
      try {
        const saved = plan
          ? await http.patch<StoredCarePlan>(`/care-plans/${plan._id}`, values)
          : await http.post<StoredCarePlan>('/care-plans', {
            ...values,
            procedureId: procedure,
            patientId,
          });
        setPlan(saved);
        setSavedAt(Date.now());
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [plan]
  );

  /** Activation is what materialises the reminder rows — nothing is scheduled before it. */
  const activate = useCallback(async () => {
    if (!plan) return;
    setIsPending(true);
    setError(null);
    try {
      setPlan(await http.post<StoredCarePlan>(`/care-plans/${plan._id}/activate`));
      setSavedAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsPending(false);
    }
  }, [plan]);

  return { plan, isLoading, isPending, error, savedAt, save, activate };
}
