'use client';

import { useCallback, useEffect, useState } from 'react';

import { DataRequestView } from '@/features/data-protection/types/data-protection.types';
import { DataRequestStatus } from '@/shared/const/data-request.const';
import { http } from '@/shared/lib/http';

type DataRequestsState = {
  requests: DataRequestView[];
  isLoading: boolean;
  hasError: boolean;
  /** The request currently being answered, so one row can be disabled without freezing the card. */
  pendingId: string | null;
  resolve: (id: string, status: DataRequestStatus, resolution: string) => Promise<void>;
  reload: () => Promise<void>;
};

/**
 * The clinic's queue of unanswered data subject requests.
 *
 * Only open ones are loaded. A settings card is not an archive, and the requests that matter here
 * are the ones with a statutory clock running on them — the answered ones are in each patient's
 * own record, where anyone asking about a particular patient will look.
 */
export function useDataRequests(): DataRequestsState {
  const [requests, setRequests] = useState<DataRequestView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setRequests(await http.get<DataRequestView[]>('/data-requests'));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Refetches rather than dropping the row locally. Completing an erasure changes the patient
   * record on the server, and a card that removed the row optimistically would be claiming an
   * outcome it has not seen confirmed.
   */
  const resolve = useCallback(
    async (id: string, status: DataRequestStatus, resolution: string) => {
      setPendingId(id);
      try {
        await http.patch<DataRequestView>(`/data-requests/${id}`, { status, resolution });
        await reload();
      } finally {
        setPendingId(null);
      }
    },
    [reload]
  );

  return { requests, isLoading, hasError, pendingId, resolve, reload };
}
