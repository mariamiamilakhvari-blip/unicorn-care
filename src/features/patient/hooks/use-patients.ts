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
  /** The patient the server created — the caller needs its id to navigate to it. */
  create: (input: CreatePatientType) => Promise<PatientSummary>;
  remove: (id: string, confirmationName: string) => Promise<void>;
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

  /*
    Returns the created patient rather than swallowing the response: intake ends on that patient's
    own page, and the id to go to is only in this body.

    The list is deliberately not re-read afterwards. Every caller leaves for the new patient the
    moment this resolves, so a second GET would fetch a list nobody is going to see and hold the
    redirect open for the length of the round trip.
  */
  const create = useCallback(
    async (input: CreatePatientType) => http.post<PatientSummary>('/patients', input),
    []
  );

  /*
    A full erasure, not the archive this replaced. The endpoint removes the patient and everything
    the clinic holds about them, so the list is re-read rather than filtered locally — there is no
    hidden row left to reason about.
  */
  const remove = useCallback(
    async (id: string, confirmationName: string) => {
      // The typed name travels in the body, not the path — it is a confirmation, and a query
      // string would put a patient's name in the server logs.
      await http.delete(`/patients/${id}`, { confirmationName });
      await reload();
    },
    [reload]
  );

  return { patients, isLoading, hasError, reload, create, remove };
}
