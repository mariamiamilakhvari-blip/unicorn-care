'use client';

import { useCallback, useEffect, useState } from 'react';

import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { BillingPeriod } from '@/shared/const/billing.const';
import { PlanKey } from '@/shared/const/plan.const';
import { http } from '@/shared/lib/http';

type SubscriptionState = {
  subscription: SubscriptionView | null;
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  changePlan: (plan: PlanKey) => Promise<void>;
  startCheckout: (plan: 'standard' | 'premium', period: BillingPeriod) => Promise<void>;
  cancelSubscription: () => Promise<void>;
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

  /** Sends the owner to Dodo's hosted checkout; the plan only changes when the webhook lands. */
  const startCheckout = useCallback(
    async (plan: 'standard' | 'premium', period: BillingPeriod) => {
      setIsPending(true);
      setError(null);
      try {
        const { checkoutUrl } = await http.post<{ checkoutUrl: string }>(
          '/subscription/checkout',
          { plan, period }
        );
        window.location.href = checkoutUrl;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
        setIsPending(false);
      }
    },
    []
  );

  /**
   * Ends the trial or the paid plan. The response is the refreshed subscription, so the card the
   * button lives on re-renders into its cancelled state without a second request.
   */
  const cancelSubscription = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      setSubscription(await http.post<SubscriptionView>('/subscription/cancel'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    subscription,
    isLoading,
    isPending,
    error,
    changePlan,
    startCheckout,
    cancelSubscription,
  };
}
