'use client';

import { useState } from 'react';

import { PatientSummary } from '@/features/patient/types/patient.types';
import { http } from '@/shared/lib/http';

/**
 * Saves the zone a clinic says a patient is recovering in.
 *
 * Local state and no store, matching the other patient-detail panels: this is one card on one
 * screen, and the value it writes is re-read from the server response rather than assumed.
 */
export const usePatientTimezone = (patientId: string, initial: string) => {
  const [timezone, setTimezone] = useState(initial);
  const [isPending, setIsPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  const save = async (next: string) => {
    setIsPending(true);
    setHasError(false);
    try {
      const updated = await http.patch<PatientSummary>(`/patients/${patientId}`, {
        timezone: next,
      });
      setTimezone(updated.timezone);
      setSavedAt(Date.now());
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  };

  return { timezone, save, isPending, savedAt, hasError };
};
