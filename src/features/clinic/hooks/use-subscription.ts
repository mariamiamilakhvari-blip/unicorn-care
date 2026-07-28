'use client';

import { useCallback, useEffect, useState } from 'react';

import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { PlanKey } from '@/shared/const/plan.const';
import { http } from '@/shared/lib/http';

type SubscriptionState = {
  subscription: SubscriptionView | null;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  changePlan: (plan: PlanKey) => Promise<void>;
};

export function useSubscription(): SubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSubscription(await http.get<SubscriptionView>('/subscription'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changePlan = useCallback(async (plan: PlanKey) => {
    setIsPending(true);
    setError(null);
    try {
      setSubscription(await http.patch<SubscriptionView>('/subscription', { plan }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsPending(false);
    }
  }, []);

  return { subscription, isLoading, isPending, error, changePlan };
}
