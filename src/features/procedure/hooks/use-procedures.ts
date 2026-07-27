'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProcedureListView, ProcedureView } from '@/features/procedure/types/procedure.types';
import {
  CreateProcedureType,
  UpdateProcedureType,
} from '@/features/procedure/validations/procedure.validation';
import { http } from '@/shared/lib/http';

type ProceduresState = {
  procedures: ProcedureView[];
  isLoading: boolean;
  error: string | null;
  create: (input: CreateProcedureType) => Promise<ProcedureView | null>;
  update: (id: string, input: UpdateProcedureType) => Promise<ProcedureView | null>;
  remove: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
};

/**
 * Loads a patient's procedures from the server rather than holding the last-created id in memory.
 * Without this the care plan builder vanished on every reload and the clinic reasonably concluded
 * nothing had saved.
 */
export function useProcedures(patientId: string): ProceduresState {
  const [procedures, setProcedures] = useState<ProcedureView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await http.get<ProcedureListView>('/procedures', { params: { patientId } });
      setProcedures(result.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: CreateProcedureType) => {
      setError(null);
      try {
        const created = await http.post<ProcedureView>('/procedures', input);
        await reload();
        return created;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
        return null;
      }
    },
    [reload]
  );

  const update = useCallback(
    async (id: string, input: UpdateProcedureType) => {
      setError(null);
      try {
        const updated = await http.patch<ProcedureView>(`/procedures/${id}`, input);
        await reload();
        return updated;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
        return null;
      }
    },
    [reload]
  );

  /** Cascades server-side: the care plan and its reminders go with the procedure. */
  const remove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await http.delete(`/procedures/${id}`);
        await reload();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
        return false;
      }
    },
    [reload]
  );

  return { procedures, isLoading, error, create, update, remove, reload };
}
