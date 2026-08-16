'use client';

import { useTranslations } from 'next-intl';

import { PricingTable } from '@/features/clinic/components/pricing-table';
import { SubscriptionStatusStrip } from '@/features/clinic/components/subscription-status-strip';
import { useSubscription } from '@/features/clinic/hooks/use-subscription';

/**
 * The pricing table for a signed-in clinic: the buttons start checkout instead of pointing at
 * sign-up. Without this a clinic that already registered was sent back to registration by every
 * plan button, with no route to actually buy.
 */
export function PricingPurchase() {
  const tCommon = useTranslations('common');
  const { subscription, isLoading, isPending, error, startCheckout } = useSubscription();

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Days left and seats used, above the plans — the two numbers that decide the purchase. */}
      {subscription && <SubscriptionStatusStrip subscription={subscription} />}

      <PricingTable
        onSelect={startCheckout}
        currentPlan={subscription?.plan}
        isPending={isPending}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
