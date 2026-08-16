'use client';

import { AlertTriangle, BellRing, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CancelSubscription } from '@/features/clinic/components/cancel-subscription';
import { PricingTable } from '@/features/clinic/components/pricing-table';
import { useSubscription } from '@/features/clinic/hooks/use-subscription';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

const METER_CELLS = 24;

/** Cancellation failures that have copy of their own. Everything else falls through raw. */
const CANCEL_ERRORS = ['NOT_CANCELLABLE', 'CANCEL_FAILED'];

/** Seat usage and plan state, plus the switcher. Shown on the clinic page. */
export function SubscriptionCard() {
  const t = useTranslations('pricing');
  const tCommon = useTranslations('common');
  const { subscription, isLoading, isPending, error, startCheckout, cancelSubscription } =
    useSubscription();

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;
  if (!subscription) return null;

  const { plan, status, activePatients, patientLimit, isAtPatientLimit, trialDaysLeft } =
    subscription;

  const usage = patientLimit === null ? null : Math.min(1, activePatients / patientLimit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" aria-hidden />
          {t('subscription')}
        </CardTitle>
        <Badge variant={status === 'active' || status === 'trialing' ? 'secondary' : 'destructive'}>
          {t(`status.${status}`)}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="font-medium">{t(`plan.${plan}.name`)}</p>
          {status === 'trialing' && trialDaysLeft !== null && (
            <span className="text-sm text-muted-foreground">
              {t('trialDaysLeft', { count: trialDaysLeft })}
            </span>
          )}
        </div>

        {/* Seat usage, so hitting the limit is never a surprise mid-consultation. */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {patientLimit === null
              ? t('activeUnlimited', { active: activePatients })
              : t('activeOfLimit', { active: activePatients, limit: patientLimit })}
          </p>
          {usage !== null && (
            // Segmented rather than a percentage-width bar: dynamic widths need inline styles,
            // which the design rules forbid, and segments match the meters used elsewhere.
            <div
              className="flex gap-px"
              role="img"
              aria-label={t('activeOfLimit', { active: activePatients, limit: patientLimit ?? 0 })}
            >
              {Array.from({ length: METER_CELLS }).map((_, cell) => (
                <span
                  key={cell}
                  className={cn(
                    'h-2 flex-1 rounded-sm',
                    cell < Math.round(usage * METER_CELLS)
                      ? isAtPatientLimit
                        ? 'bg-destructive'
                        : 'bg-moss'
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {(isAtPatientLimit || !subscription.canWrite) && (
          <p className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            {isAtPatientLimit ? t('limitReachedHelp') : t('inactiveHelp')}
          </p>
        )}

        {/*
          What is happening to the patients, stated separately from what is happening to the
          account. A lapsed clinic's first question is whether the people in their care are still
          being reminded, and the plan badge above cannot answer it — writing and sending stop
          fourteen days apart.
        */}
        {!subscription.canWrite && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <BellRing
              className={cn(
                'mt-0.5 size-4 shrink-0',
                subscription.remindersActive ? 'text-primary' : 'text-destructive'
              )}
              aria-hidden
            />
            {subscription.isInGrace && subscription.graceDaysLeft !== null
              ? t('remindersUntil', { count: subscription.graceDaysLeft })
              : t('remindersStopped')}
          </p>
        )}

        {/* Known codes get a sentence the clinic can act on; anything else shows raw. */}
        {error && (
          <p className="text-sm font-medium text-destructive">
            {CANCEL_ERRORS.includes(error) ? t(`cancelError.${error}`) : error}
          </p>
        )}

        <PricingTable onSelect={startCheckout} currentPlan={plan} isPending={isPending} />

        {/* Below the plans: leaving is the last thing to offer, after every way to stay. */}
        <CancelSubscription
          subscription={subscription}
          isPending={isPending}
          onCancel={cancelSubscription}
        />
      </CardContent>
    </Card>
  );
}
