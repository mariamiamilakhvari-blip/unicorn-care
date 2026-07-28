'use client';

import { Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { formatPrice, PLANS } from '@/shared/const/plan.const';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { cn } from '@/shared/lib/utils';

type PricingTableProps = {
  /** On the marketing page every card links to sign-up; in the dashboard they switch plan. */
  onSelect?: (plan: (typeof PLANS)[number]['key']) => void;
  currentPlan?: string;
  isPending?: boolean;
};

export function PricingTable({ onSelect, currentPlan, isPending }: PricingTableProps) {
  const t = useTranslations('pricing');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLANS.map(plan => {
        const isCurrent = plan.key === currentPlan;
        const isHighlighted = plan.key === 'standard';

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

                {onSelect ? (
                  <Button
                    type="button"
                    variant={isHighlighted ? 'default' : 'outline'}
                    disabled={isCurrent || isPending}
                    onClick={() => onSelect(plan.key)}
                  >
                    {isCurrent ? t('currentPlan') : t('choosePlan')}
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
  );
}
