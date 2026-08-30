'use client';

import { CalendarCheck, CircleCheck, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { OccurrenceCard } from '@/features/care-plan/components/occurrence-card';
import { usePortalPlan } from '@/features/care-plan/hooks/use-portal-plan';
import { PortalDay } from '@/features/care-plan/types/portal.types';
import { PushOptIn } from '@/features/notifications/components/push-opt-in';
import { useTimezoneSync } from '@/features/patient/hooks/use-timezone-sync';
import { PortalRatingCard } from '@/features/rating/components/portal-rating-card';
import { RecoveryGuidePanel } from '@/features/recovery-guide/components/recovery-guide-panel';
import { RecoveryLogForm } from '@/features/recovery-log/components/recovery-log-form';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PORTAL_PRIVACY_ROUTE } from '@/shared/const/routes.const';

type PortalPlanProps = {
  /** The number on the patient's record, offered as the default on the concern form. */
  patientPhone: string;
};

export function PortalPlan({ patientPhone }: PortalPlanProps) {
  const t = useTranslations('portal');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { plan, isLoading, hasError, reload, complete } = usePortalPlan();
  const [busyId, setBusyId] = useState<string | null>(null);

  /*
    Reports this device's zone and re-reads the plan when it turns out the patient has moved. The
    reload is the visible half: the server has just rebuilt their pending reminders on the new wall
    clock, so the times already on screen are the ones they left behind.
  */
  useTimezoneSync(reload);

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

  // Both keys are already the clinic's calendar day, so this is a string compare and not a
  // second, subtly different, notion of "today".
  const today = plan.days.find(day => day.date === plan.todayKey);
  const upcoming = plan.days.filter(day => day.date > plan.todayKey);

  /*
    What an empty day actually means, which is three different things.

    This used to say "your plan continues tomorrow" in every one of them. For a patient whose plan
    had finished that is simply false — it tells someone with nothing left to do to come back
    tomorrow for tasks that will never arrive, and it is the state a completed plan sits in for
    good. It was also wrong whenever the next task was three days out rather than one.

    `rehabEndsAt` is the plan the portal is holding: `null` is the service finding no *active*
    plan, which covers both a finished one and a patient who has none yet. Neither of those
    continues, so neither may claim to.
  */
  const nextDay = upcoming[0] ?? null;
  const nothingTodayBody = !plan.rehabEndsAt
    ? t('nothingTodayNoPlan')
    : nextDay
      ? t('nothingTodayNext', {
        // Same reading `UpcomingDays` uses: the key is already the clinic's calendar day and
        // `new Date('YYYY-MM-DD')` is UTC midnight, so it is formatted in UTC or it shifts.
        date: format.dateTime(new Date(nextDay.date), { dateStyle: 'medium', timeZone: 'UTC' }),
      })
      : t('nothingTodayHelp');

  return (
    <div className="flex flex-col gap-6">
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
              {format.dateTime(new Date(plan.nextCheckup.scheduledAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: plan.timeZone,
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
                timeZone={plan.timeZone}
                onComplete={(id, outcome) => void handleComplete(id, outcome)}
                isBusy={busyId === occurrence.id}
              />
            ))}
          </ul>
        ) : (
          <NothingToday title={t('nothingToday')} body={nothingTodayBody} />
        )}
      </section>

      {upcoming.length > 0 && (
        <UpcomingDays days={upcoming} timeZone={plan.timeZone} label={t('upcoming')} />
      )}

      {/* Renders nothing unless the plan asks for a check-in and today has none filed yet. */}
      <RecoveryLogForm />

      {/* A patient worried about a symptom reaches clinic-authored guidance and the
          "contact your clinic" path — the only route the portal offers for a medical question. */}
      <RecoveryGuidePanel patientPhone={patientPhone} />

      {/* Renders nothing until a plan has actually finished, so it never competes with today's
          doses. Last on the page for the same reason. */}
      <PortalRatingCard />

      {/* Renders nothing at all where notifications cannot work. Moved down here from the top of
          the plan: it is an optional convenience, and it was pushing the doses a patient opened
          the portal to read below a line about browser capabilities. */}
      <PushOptIn />

      {/* The way to consent settings, the data export and the correction/erasure form. A quiet
          footer link on purpose: it has to be findable without asking, and it is not what a
          patient two days out of surgery opened this page for. */}
      <PrivacyLink label={t('privacyLink')} />
    </div>
  );
}

/**
 * Standing rights are not much use if nobody can find them, so this is on every portal visit
 * rather than behind a menu — the portal has no menu, by design.
 */
function PrivacyLink({ label }: { label: string }) {
  return (
    <nav className="border-t border-border pt-4">
      <Link
        href={PORTAL_PRIVACY_ROUTE}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        <ShieldCheck className="size-4" aria-hidden />
        {label}
      </Link>
    </nav>
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

type UpcomingDaysProps = { days: PortalDay[]; timeZone: string; label: string };

function UpcomingDays({ days, timeZone, label }: UpcomingDaysProps) {
  const format = useFormatter();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">{label}</h2>
      {days.map(day => (
        <div key={day.date} className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            {/* `date` is already the clinic's calendar day, and `new Date('YYYY-MM-DD')` reads it
                as UTC midnight — rendering it in any other zone would shift the heading off the
                day it names, backwards for every zone west of UTC. */}
            {format.dateTime(new Date(day.date), { dateStyle: 'full', timeZone: 'UTC' })}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {day.occurrences.map(occurrence => (
              <li key={occurrence.id} className="flex justify-between gap-4 rounded-md border border-border px-3 py-2">
                <span className="truncate">{occurrence.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {format.dateTime(new Date(occurrence.scheduledAt), {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone,
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
