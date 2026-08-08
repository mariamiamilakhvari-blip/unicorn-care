'use client';

import { useCallback, useEffect, useState } from 'react';

import { EmailDeliveryView } from '@/features/notifications/types/email.types';
import { http } from '@/shared/lib/http';

type EmailDeliveryState = {
  delivery: EmailDeliveryView | null;
  isLoading: boolean;
  isClearing: boolean;
  error: string | null;
  clearSuppression: () => Promise<void>;
};

export function useEmailDelivery(patientId: string): EmailDeliveryState {
  const [delivery, setDelivery] = useState<EmailDeliveryView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDelivery(await http.get<EmailDeliveryView>(`/patients/${patientId}/email-delivery`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearSuppression = useCallback(async () => {
    setIsClearing(true);
    setError(null);
    try {
      await http.delete(`/patients/${patientId}/email-delivery`);
      // Re-read rather than patching locally: the server owns whether it actually lifted.
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsClearing(false);
    }
  }, [patientId, load]);

  return { delivery, isLoading, isClearing, error, clearSuppression };
}
