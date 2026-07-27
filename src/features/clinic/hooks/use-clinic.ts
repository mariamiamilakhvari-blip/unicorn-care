'use client';

import { useCallback, useEffect, useState } from 'react';

import { ClinicProfile, CreateStaffResult } from '@/features/clinic/types/clinic.types';
import {
  ClinicProfileType,
  CreateStaffType,
} from '@/features/clinic/validations/clinic.validation';
import { http } from '@/shared/lib/http';

type ClinicState = {
  clinic: ClinicProfile | null;
  invite: CreateStaffResult | null;
  isLoading: boolean;
  error: string | null;
  createStaff: (input: CreateStaffType) => Promise<void>;
  updateClinic: (input: ClinicProfileType) => Promise<void>;
  savedAt: number | null;
  isPending: boolean;
  clearInvite: () => void;
};

export function useClinic(): ClinicState {
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [invite, setInvite] = useState<CreateStaffResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setClinic(await http.get<ClinicProfile>('/clinic'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** The temporary password comes back once — there is no email channel to resend it on. */
  const createStaff = useCallback(async (input: CreateStaffType) => {
    setError(null);
    try {
      setInvite(await http.post<CreateStaffResult>('/clinic/staff', input));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    }
  }, []);

  /** The timezone lives here, and an invalid one breaks plan activation — so this must be editable. */
  const updateClinic = useCallback(async (input: ClinicProfileType) => {
    setIsPending(true);
    setError(null);
    try {
      setClinic(await http.patch<ClinicProfile>('/clinic', input));
      setSavedAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    clinic,
    invite,
    isLoading,
    isPending,
    savedAt,
    error,
    createStaff,
    updateClinic,
    clearInvite: () => setInvite(null),
  };
}
