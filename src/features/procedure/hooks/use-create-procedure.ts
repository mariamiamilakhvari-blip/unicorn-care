'use client';

import { useCallback, useState } from 'react';

import { ProcedureView } from '@/features/procedure/types/procedure.types';
import { CreateProcedureType } from '@/features/procedure/validations/procedure.validation';
import { http } from '@/shared/lib/http';

type CreateProcedureState = {
  procedureId: string | null;
  isPending: boolean;
  error: string | null;
  create: (input: CreateProcedureType) => Promise<void>;
};

export function useCreateProcedure(): CreateProcedureState {
  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateProcedureType) => {
    setIsPending(true);
    setError(null);
    try {
      const created = await http.post<ProcedureView>('/procedures', input);
      setProcedureId(created._id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsPending(false);
    }
  }, []);

  return { procedureId, isPending, error, create };
}
