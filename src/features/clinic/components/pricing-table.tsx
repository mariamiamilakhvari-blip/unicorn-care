'use client';

import { Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { BILLING_PERIODS, BillingPeriod } from '@/shared/const/billing.const';
import { formatPrice, PLANS } from '@/shared/const/plan.const';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { cn } from '@/shared/lib/utils';

type PricingTableProps = {
  /** On the marketing page every card links to sign-up; in the dashboard they start checkout. */
  onSelect?: (plan: 'standard' | 'premium', period: BillingPeriod) => void;
  currentPlan?: string;
  isPending?: boolean;
};

export function PricingTable({ onSelect, currentPlan, isPending }: PricingTableProps) {
  const t = useTranslations('pricing');
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <div className="flex flex-col gap-4">
      {/* Annual is the default because every headline price on the page is the annual rate. */}
      <div className="flex items-center gap-1 self-start rounded-md border border-border p-0.5">
        {BILLING_PERIODS.map(option => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={period === option}
            onClick={() => setPeriod(option)}
            className={cn(
              'h-7 px-3 text-xs font-medium',
              period === option
                ? 'bg-primary/10 text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`period.${option}`)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const isHighlighted = plan.key === 'standard';
          // Narrowed outside the callback so the union excludes 'trial' at the call site.
          const paidKey = plan.key === 'trial' ? null : plan.key;

          return (
            <Card
              key={plan.key}
              className={cn('flex flex-col', isHighlighted && 'border-primary-edge')}
            >
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{t(`plan.${plan.key}.name`)}</CardTitle>
                  {isHighlighted && <Badge>{t('mostPopular')}</Badge>}
                  {isCurrent && <Badge variant="secondary">{t('currentPlan')}</Badge>}
                </div>

                {plan.key === 'trial' ? (
                  <p className="text-2xl font-semibold">{t('free')}</p>
                ) : (
                  <div>
                    <p className="text-2xl font-semibold">
                      {formatPrice(plan.monthlyPriceMinor)}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}
                        {t('perMonth')}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('billedAnnually', {
                        annual: formatPrice(plan.annualPriceMinor),
                        saving: formatPrice(plan.annualSavingMinor),
                      })}
                    </p>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {plan.patientLimit === null
                    ? t('unlimitedPatients')
                    : t('patientLimit', { count: plan.patientLimit })}
                </p>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <ul className="flex flex-col gap-2 text-sm">
                  {plan.features.map(feature => (
                    <li key={feature.key} className="flex items-start gap-2">
                      {feature.status === 'available' ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                      ) : (
                      // Planned features are shown as upcoming, never ticked — nobody should pay
                      // for something that does not exist yet.
                        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span
                        className={cn(feature.status === 'planned' && 'text-muted-foreground')}
                      >
                        {t(`feature.${feature.key}`)}
                        {feature.status === 'planned' && ` — ${t('comingSoon')}`}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">{t(`plan.${plan.key}.bestFor`)}</p>

                  {/* The trial is granted at sign-up, never bought, so it has no checkout. */}
                  {onSelect && paidKey ? (
                    <Button
                      type="button"
                      variant={isHighlighted ? 'default' : 'outline'}
                      disabled={isCurrent || isPending}
                      onClick={() => onSelect(paidKey, period)}
                    >
                      {isCurrent ? t('currentPlan') : t('choosePlan')}
                    </Button>
                  ) : onSelect ? (
                    // Signed in: the trial is already granted, so sending them to sign-up would
                    // bounce off a form they have completed.
                    <Button type="button" variant="outline" disabled>
                      {isCurrent ? t('currentPlan') : t('trialIncluded')}
                    </Button>
                  ) : (
                    <Button asChild variant={isHighlighted ? 'default' : 'outline'}>
                      <Link href={CLINIC_SIGN_UP_ROUTE}>
                        {plan.key === 'trial' ? t('startTrial') : t('choosePlan')}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
