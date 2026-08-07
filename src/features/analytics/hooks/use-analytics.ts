'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  AnalyticsClinicOption,
  ClinicAnalytics,
} from '@/features/analytics/types/analytics.types';
import { http } from '@/shared/lib/http';

type AnalyticsState = {
  clinics: AnalyticsClinicOption[];
  clinicId: string;
  setClinicId: (id: string) => void;
  year: number;
  setYear: (year: number) => void;
  quarter: number;
  setQuarter: (quarter: number) => void;
  analytics: ClinicAnalytics | null;
  isLoading: boolean;
  isSending: boolean;
  sentTo: string | null;
  error: string | null;
  sendReport: () => Promise<void>;
};

export function useAnalytics(): AnalyticsState {
  const [clinics, setClinics] = useState<AnalyticsClinicOption[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getUTCMonth() / 3) + 1);
  const [analytics, setAnalytics] = useState<ClinicAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    http
      .get<{ items: AnalyticsClinicOption[] }>('/admin/analytics')
      .then(result => {
        if (cancelled) return;
        setClinics(result.items);
        // Selecting the first clinic means the panel shows numbers rather than an empty prompt.
        setClinicId(current => current || (result.items[0]?.id ?? ''));
      })
      .catch(caught => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'ERROR');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!clinicId) return;

    setIsLoading(true);
    setError(null);
    // A figure from the previous quarter sitting under a new heading is worse than a spinner.
    setAnalytics(null);
    setSentTo(null);
    try {
      const params = new URLSearchParams({
        clinicId,
        kind: 'quarter',
        year: String(year),
        quarter: String(quarter),
      });
      setAnalytics(await http.get<ClinicAnalytics>(`/admin/analytics?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [clinicId, year, quarter]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendReport = useCallback(async () => {
    if (!clinicId) return;

    setIsSending(true);
    setError(null);
    setSentTo(null);
    try {
      const result = await http.post<{ sent: true; to: string }>('/admin/reports', {
        clinicId,
        year,
        quarter,
      });
      setSentTo(result.to);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsSending(false);
    }
  }, [clinicId, year, quarter]);

  return {
    clinics,
    clinicId,
    setClinicId,
    year,
    setYear,
    quarter,
    setQuarter,
    analytics,
    isLoading,
    isSending,
    sentTo,
    error,
    sendReport,
  };
}
