'use client';

import { useCallback, useEffect, useState } from 'react';

import { RecoveryGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { UpsertRecoveryGuideType } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { http } from '@/shared/lib/http';
import { AppLocale } from '@/shared/types/roles';

type ProcedureGuideState = {
  guide: RecoveryGuideView | null;
  isLoading: boolean;
  isPending: boolean;
  savedAt: number | null;
  error: string | null;
  save: (input: UpsertRecoveryGuideType) => Promise<void>;
};

/**
 * The guide for one procedure type, edited inside the care plan.
 *
 * Content is stored per clinic + procedure type + language, not per patient — a clinic writes
 * "what is normal after rhinoplasty" once and every rhinoplasty patient sees it. Editing it here
 * therefore updates it for all of them, which is why the UI says so.
 */
export function useProcedureGuide(
  manipulationType: string | null,
  locale: AppLocale
): ProcedureGuideState {
  const [guide, setGuide] = useState<RecoveryGuideView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!manipulationType) {
      setGuide(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await http.get<RecoveryGuideView>('/recovery-guides', {
        params: { manipulationType, locale },
      });
      setGuide(result);
    } catch {
      // Nothing written for this procedure type yet — a normal first-visit state.
      setGuide(null);
    } finally {
      setIsLoading(false);
    }
  }, [manipulationType, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (input: UpsertRecoveryGuideType) => {
      setIsPending(true);
      setError(null);
      try {
        const saved = await http.post<RecoveryGuideView>('/recovery-guides', input);
        setGuide(saved);
        setSavedAt(Date.now());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { guide, isLoading, isPending, savedAt, error, save };
}
