'use client';

import { useCallback, useEffect, useState } from 'react';

import { DoctorView } from '@/features/procedure/types/doctor.types';
import { http } from '@/shared/lib/http';

type DoctorsState = {
  doctors: DoctorView[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useDoctors(): DoctorsState {
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await http.get<{ items: DoctorView[] }>('/doctors');
      setDoctors(result.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { doctors, isLoading, error, reload };
}
