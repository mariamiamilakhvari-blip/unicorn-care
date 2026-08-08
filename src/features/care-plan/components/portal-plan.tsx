'use client';

import { CalendarCheck, CircleCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { OccurrenceCard } from '@/features/care-plan/components/occurrence-card';
import { usePortalPlan } from '@/features/care-plan/hooks/use-portal-plan';
import { PortalDay } from '@/features/care-plan/types/portal.types';
import { PushOptIn } from '@/features/notifications/components/push-opt-in';
import { PortalRatingCard } from '@/features/rating/components/portal-rating-card';
import { RecoveryGuidePanel } from '@/features/recovery-guide/components/recovery-guide-panel';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

function isSameUtcDay(dateIso: string, referenceIso: string): boolean {
  return dateIso === referenceIso.slice(0, 10);
}

export function PortalPlan() {
  const t = useTranslations('portal');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { plan, isLoading, hasError, reload, complete } = usePortalPlan();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleComplete(id: string, outcome: 'done' | 'skipped') {
    setBusyId(id);
    try {
      await complete(id, outcome);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  if (hasError || !plan) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{tCommon('error')}</p>
        <Button variant="outline" onClick={() => void reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const today = plan.days.find(day => isSameUtcDay(day.date, plan.todayIso));
  const upcoming = plan.days.filter(day => day.date > plan.todayIso.slice(0, 10));

  return (
    <div className="flex flex-col gap-6">
      <PushOptIn />

      {plan.nextCheckup && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-primary" aria-hidden />
              {t('nextCheckup')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{plan.nextCheckup.title}</p>
            <p className="text-sm text-muted-foreground">
              {format.dateTime(new Date(plan.nextCheckup.dueAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t('today')}</h2>
        {today && today.occurrences.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {today.occurrences.map(occurrence => (
              <OccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                onComplete={(id, outcome) => void handleComplete(id, outcome)}
                isBusy={busyId === occurrence.id}
              />
            ))}
          </ul>
        ) : (
          <NothingToday title={t('nothingToday')} body={t('nothingTodayHelp')} />
        )}
      </section>

      {upcoming.length > 0 && <UpcomingDays days={upcoming} label={t('upcoming')} />}

      {/* A patient worried about a symptom reaches clinic-authored guidance and the
          "contact your clinic" path — the only route the portal offers for a medical question. */}
      <RecoveryGuidePanel />

      {/* Renders nothing until a plan has actually finished, so it never competes with today's
          doses. Last on the page for the same reason. */}
      <PortalRatingCard />
    </div>
  );
}

/**
 * The empty day.
 *
 * A blank line of grey text reads like the portal failed to load something — which, to a patient
 * two days out of surgery checking whether they have missed a dose, is the wrong thing to leave
 * ambiguous. This says the same fact positively and looks deliberate: nothing is due, and that is
 * the plan working, not a gap in it.
 */
function NothingToday({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary-edge bg-moss/10 p-4">
      <CircleCheck className="size-6 shrink-0 text-moss" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function UpcomingDays({ days, label }: { days: PortalDay[]; label: string }) {
  const format = useFormatter();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">{label}</h2>
      {days.map(day => (
        <div key={day.date} className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            {format.dateTime(new Date(day.date), { dateStyle: 'full' })}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {day.occurrences.map(occurrence => (
              <li key={occurrence.id} className="flex justify-between gap-4 rounded-md border border-border px-3 py-2">
                <span className="truncate">{occurrence.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {format.dateTime(new Date(occurrence.dueAt), {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
