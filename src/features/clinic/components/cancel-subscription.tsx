'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { Button } from '@/shared/components/ui/button';

type CancelSubscriptionProps = {
  subscription: SubscriptionView;
  isPending: boolean;
  onCancel: () => void;
};

/**
 * The way out of a trial that does not involve deleting the account.
 *
 * Presentational on purpose — it takes the subscription and the action as props rather than
 * calling `useSubscription` itself, so it shares one fetch and one piece of state with the card it
 * sits in. A second hook instance here would show a stale plan next to a fresh one.
 *
 * Two steps rather than one: a single click that ends billing is too easy to hit next to the plan
 * buttons. It stops short of the typed-name confirmation the delete card uses, because this is
 * reversible — nothing clinical is touched and the clinic can buy a plan again the same minute.
 */
export function CancelSubscription({
  subscription,
  isPending,
  onCancel,
}: CancelSubscriptionProps) {
  const t = useTranslations('pricing');
  const [isConfirming, setIsConfirming] = useState(false);

  if (!subscription.canCancel) return null;

  const isTrial = subscription.status === 'trialing';

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      {!isConfirming ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setIsConfirming(true)}
        >
          {isTrial ? t('cancelTrial') : t('cancelPlan')}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <p className="text-sm text-muted-foreground">
            {isTrial ? t('cancelTrialBlurb') : t('cancelPlanBlurb')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onCancel}>
              {isPending ? t('cancelling') : t('cancelConfirm')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setIsConfirming(false)}
            >
              {t('cancelKeep')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
