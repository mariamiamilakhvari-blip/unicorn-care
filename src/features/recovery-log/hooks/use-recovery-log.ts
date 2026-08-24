'use client';

import { useCallback, useEffect, useState } from 'react';

import { RecoveryLogView } from '@/features/recovery-log/types/recovery-log.types';
import { CreateRecoveryLogType } from '@/features/recovery-log/validations/recovery-log.validation';
import { http } from '@/shared/lib/http';

type RecoveryLogState = {
  items: RecoveryLogView[];
  /** Which day of recovery the patient is on; -1 when there is no active plan. */
  todayIndex: number;
  /** Today's entry, if they have already filed one — the form shows it rather than a blank. */
  today: RecoveryLogView | null;
  isLoading: boolean;
  isSaving: boolean;
  hasError: boolean;
  submit: (input: CreateRecoveryLogType) => Promise<boolean>;
};

type ListResponse = { items: RecoveryLogView[]; todayIndex: number };

export function useRecoveryLog(): RecoveryLogState {
  const [items, setItems] = useState<RecoveryLogView[]>([]);
  const [todayIndex, setTodayIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await http.get<ListResponse>('/patient-portal/recovery-logs');
      setItems(result.items);
      setTodayIndex(result.todayIndex);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = useCallback(
    async (input: CreateRecoveryLogType) => {
      setIsSaving(true);
      setHasError(false);
      try {
        await http.post('/patient-portal/recovery-logs', input);
        await reload();
        return true;
      } catch {
        setHasError(true);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [reload]
  );

  return {
    items,
    todayIndex,
    today: items.find(item => item.dayIndex === todayIndex) ?? null,
    isLoading,
    isSaving,
    hasError,
    submit,
  };
}
