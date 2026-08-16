'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ConsentChangeResult,
  ConsentSettingsView,
  ConsentView,
  DataRequestView,
} from '@/features/data-protection/types/data-protection.types';
import { ConsentType } from '@/shared/const/consent-type.const';
import { DataRequestKind } from '@/shared/const/data-request.const';
import { http } from '@/shared/lib/http';

type PrivacySettingsState = {
  consents: ConsentView[];
  requests: DataRequestView[];
  isLoading: boolean;
  hasError: boolean;
  /** The consent currently being written, so one switch can be disabled without freezing the page. */
  pendingType: ConsentType | null;
  setConsent: (type: ConsentType, granted: boolean) => Promise<void>;
  fileRequest: (kind: DataRequestKind, detail: string) => Promise<void>;
  reload: () => Promise<void>;
};

/**
 * Everything the portal's privacy screen reads and writes.
 *
 * Both lists are loaded together because they answer one question between them — what is being
 * done with my data, and what have I asked to change about it — and a screen that filled in half
 * at a time would read as broken.
 *
 * Every write refetches instead of patching local state. The server decides what a consent change
 * means: withdrawing portal access ends this session, and a locally-optimistic switch would leave
 * the patient looking at a page that no longer reflects anything true.
 */
export function usePrivacySettings(): PrivacySettingsState {
  const [consents, setConsents] = useState<ConsentView[]>([]);
  const [requests, setRequests] = useState<DataRequestView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pendingType, setPendingType] = useState<ConsentType | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [settings, filed] = await Promise.all([
        http.get<ConsentSettingsView>('/patient-portal/consent'),
        http.get<DataRequestView[]>('/patient-portal/data-request'),
      ]);
      setConsents(settings.consents);
      setRequests(filed);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      setPendingType(type);
      try {
        await http.post<ConsentChangeResult>('/patient-portal/consent', { type, granted });
        await reload();
      } finally {
        setPendingType(null);
      }
    },
    [reload]
  );

  const fileRequest = useCallback(
    async (kind: DataRequestKind, detail: string) => {
      await http.post<DataRequestView>('/patient-portal/data-request', { kind, detail });
      await reload();
    },
    [reload]
  );

  return { consents, requests, isLoading, hasError, pendingType, setConsent, fileRequest, reload };
}
