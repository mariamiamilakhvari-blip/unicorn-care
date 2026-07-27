'use client';

import { useCallback, useState } from 'react';

import { AccessLinkResult } from '@/features/patient/types/patient.types';
import { http } from '@/shared/lib/http';

type AccessLinkState = {
  link: AccessLinkResult | null;
  isPending: boolean;
  hasError: boolean;
  issue: (patientId: string) => Promise<void>;
  revoke: (patientId: string) => Promise<void>;
  clear: () => void;
};

/**
 * The issued URL lives in component state only. It is never re-fetchable — the server stores
 * just the token hash — so closing the dialog is the last chance to copy it.
 */
export function useAccessLink(): AccessLinkState {
  const [link, setLink] = useState<AccessLinkResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  const issue = useCallback(async (patientId: string) => {
    setIsPending(true);
    setHasError(false);
    try {
      setLink(await http.post<AccessLinkResult>(`/patients/${patientId}/access-link`));
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  }, []);

  const revoke = useCallback(async (patientId: string) => {
    setIsPending(true);
    setHasError(false);
    try {
      await http.delete(`/patients/${patientId}/access-link`);
      setLink(null);
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  }, []);

  const clear = useCallback(() => setLink(null), []);

  return { link, isPending, hasError, issue, revoke, clear };
}
