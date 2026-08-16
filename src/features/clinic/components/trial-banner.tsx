'use client';

import { AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useSubscription } from '@/features/clinic/hooks/use-subscription';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

/**
 * Trial and lapsed states surfaced on the dashboard.
 *
 * A newly registered clinic otherwise had no route to buying at all — the plan switcher lives on
 * the clinic page and nothing pointed there.
 *
 * A running trial and a dead one are the same sentence in different registers, so they are drawn
 * differently: the countdown is brand-coloured and informational, while a clinic that can no
 * longer write anything gets the destructive treatment and is told what stopped working. Both
 * read as the same beige note before, and an expired trial looked like an advert.
 */
export function TrialBanner() {
  const t = useTranslations('pricing');
  const { subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) return null;

  const { status, trialDaysLeft, canWrite, isInGrace, isGraceWarning, graceDaysLeft } =
    subscription;
  if (status === 'active') return null;

  const isTrial = status === 'trialing';

  return (
    <div
      className={cn(
        'animate-rise flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4',
        canWrite ? 'border-primary-edge bg-primary/10' : 'border-destructive/40 bg-destructive/5'
      )}
      // Announced, not just shown: a clinic that has lost the ability to write needs to hear it
      // whether or not they were looking at the top of the page when it loaded.
      role={canWrite ? undefined : 'alert'}
    >
      <p className="flex items-center gap-2 text-sm">
        {canWrite ? (
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        )}
        {/*
          Three different sentences for three genuinely different situations, in the order they
          happen to a clinic. A lapsed clinic whose patients are still being reminded and one whose
          patients are not are not the same emergency, and telling both "your subscription is
          inactive" hid a countdown that ends in reminders stopping.
        */}
        {isTrial && trialDaysLeft !== null
          ? t('trialBanner', { count: trialDaysLeft })
          : isInGrace && graceDaysLeft !== null
            ? t(isGraceWarning ? 'graceWarning' : 'graceActive', { count: graceDaysLeft })
            : t(`blocked.${status}`)}
      </p>
      <Button asChild size="sm">
        <Link href="/pricing">{t('viewPlans')}</Link>
      </Button>
    </div>
  );
}
