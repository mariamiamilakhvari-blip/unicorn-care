'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useSubscription } from '@/features/clinic/hooks/use-subscription';
import { Button } from '@/shared/components/ui/button';

/**
 * Trial and lapsed states surfaced on the dashboard.
 *
 * A newly registered clinic otherwise had no route to buying at all — the plan switcher lives on
 * the clinic page and nothing pointed there.
 */
export function TrialBanner() {
  const t = useTranslations('pricing');
  const { subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) return null;

  const { status, trialDaysLeft } = subscription;
  if (status === 'active') return null;

  const isTrial = status === 'trialing';

  return (
    <div className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-edge bg-primary/10 p-4">
      <p className="flex items-center gap-2 text-sm">
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        {isTrial && trialDaysLeft !== null
          ? t('trialBanner', { count: trialDaysLeft })
          : t('inactiveHelp')}
      </p>
      <Button asChild size="sm">
        <Link href="/pricing">{t('viewPlans')}</Link>
      </Button>
    </div>
  );
}
