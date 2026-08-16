'use client';

import { CalendarClock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { Badge } from '@/shared/components/ui/badge';

/**
 * Where a signed-in clinic actually stands, shown above the plans they are being asked to buy.
 *
 * The pricing page listed what each plan includes and said nothing about the plan the clinic is
 * already on — so "up to 5 active patients" was a claim about the product rather than a number
 * they could check themselves against, and a trial with one day left looked identical to one with
 * seven. Both figures come from the same `/subscription` read the dashboard uses.
 */
export function SubscriptionStatusStrip({ subscription }: { subscription: SubscriptionView }) {
  const t = useTranslations('pricing');

  const { status, plan, trialDaysLeft, activePatients, patientLimit, canWrite } = subscription;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{t(`plan.${plan}.name`)}</p>
        <Badge variant={canWrite ? 'secondary' : 'destructive'}>{t(`status.${status}`)}</Badge>
      </div>

      {status === 'trialing' && trialDaysLeft !== null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
          {t('trialDaysLeft', { count: trialDaysLeft })}
        </p>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4 shrink-0 text-primary" aria-hidden />
        {patientLimit === null
          ? t('activeUnlimited', { active: activePatients })
          : t('activeOfLimit', { active: activePatients, limit: patientLimit })}
      </p>
    </div>
  );
}
