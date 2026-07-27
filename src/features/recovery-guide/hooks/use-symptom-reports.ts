'use client';

import { useCallback, useEffect, useState } from 'react';

import { SymptomReportView } from '@/features/recovery-guide/types/recovery-guide.types';
import { http } from '@/shared/lib/http';

type SymptomReportsState = {
  reports: SymptomReportView[];
  openCount: number;
  isLoading: boolean;
  review: (id: string, status: SymptomReportView['status'], clinicNote: string) => Promise<void>;
};

export function useSymptomReports(): SymptomReportsState {
  const [reports, setReports] = useState<SymptomReportView[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await http.get<{ items: SymptomReportView[]; openCount: number }>(
        '/symptom-reports'
      );
      setReports(result.items ?? []);
      setOpenCount(result.openCount ?? 0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const review = useCallback(
    async (id: string, status: SymptomReportView['status'], clinicNote: string) => {
      await http.patch(`/symptom-reports/${id}`, { status, clinicNote });
      await reload();
    },
    [reload]
  );

  return { reports, openCount, isLoading, review };
}
