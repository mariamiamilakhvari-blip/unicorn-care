'use client';

import { useCallback, useEffect, useState } from 'react';

import { PatientListResult, PatientSummary } from '@/features/patient/types/patient.types';
import { CreatePatientType } from '@/features/patient/validations/patient.validation';
import { http } from '@/shared/lib/http';

type PatientsState = {
  patients: PatientSummary[];
  isLoading: boolean;
  hasError: boolean;
  reload: () => Promise<void>;
  create: (input: CreatePatientType) => Promise<void>;
  archive: (id: string) => Promise<void>;
};

export function usePatients(query?: string): PatientsState {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await http.get<PatientListResult>('/patients', { params: { q: query } });
      setPatients(result.items);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: CreatePatientType) => {
      await http.post<PatientSummary>('/patients', input);
      await reload();
    },
    [reload]
  );

  /** Soft delete: the API archives rather than removing the clinical record. */
  const archive = useCallback(
    async (id: string) => {
      await http.delete(`/patients/${id}`);
      await reload();
    },
    [reload]
  );

  return { patients, isLoading, hasError, reload, create, archive };
}
