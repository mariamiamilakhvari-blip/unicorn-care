'use client';

import { useTranslations } from 'next-intl';

import { ClinicAnalytics, Rate } from '@/features/analytics/types/analytics.types';
import { cn } from '@/shared/lib/utils';

/** `null` is not zero: no attempts means no rate, and 0% would report a quiet quarter as failure. */
function percent(value: number | null, fallback: string): string {
  return value === null ? fallback : `${Math.round(value * 100)}%`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
      <p className="font-heading text-2xl font-semibold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Bar widths as literal classes, in twelfths.
 *
 * A percentage width would need an inline style, which §0 forbids, and an arbitrary Tailwind
 * value would never be compiled — the JIT only emits classes it can see written out. Twelfths are
 * the finest division the standard scale offers, and the exact figure is printed beside every bar
 * anyway, so the bar carries the comparison and the text carries the precision.
 */
const BAR_WIDTHS = [
  'w-0',
  'w-1/12',
  'w-2/12',
  'w-3/12',
  'w-4/12',
  'w-5/12',
  'w-6/12',
  'w-7/12',
  'w-8/12',
  'w-9/12',
  'w-10/12',
  'w-11/12',
  'w-full',
];

function barWidth(share: number): string {
  const twelfths = Math.round(Math.max(0, Math.min(1, share)) * 12);
  return BAR_WIDTHS[twelfths];
}

/**
 * A proportion as a bar. Inline SVG would be sharper, but this is one dimension of one number —
 * a filled div is the whole chart, and it inherits the theme without a second colour system.
 */
function Bar({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div className={cn('h-full rounded-full bg-moss', barWidth(share))} />
      </div>
    </div>
  );
}

function DeliveryBar({ label, rate, noData }: { label: string; rate: Rate; noData: string }) {
  if (rate.attempted === 0) return <Bar label={label} value={noData} share={0} />;
  return (
    <Bar
      label={label}
      value={`${percent(rate.rate, noData)} · ${rate.delivered}/${rate.attempted}`}
      share={rate.rate ?? 0}
    />
  );
}

export function Metrics({ analytics }: { analytics: ClinicAnalytics }) {
  const t = useTranslations('analytics');
  const noData = t('noData');
  const answered = analytics.reminders.done + analytics.reminders.skipped + analytics.reminders.missed;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={t('activePatients')}
          value={String(analytics.activePatients)}
          hint={t('newPatients', { count: analytics.newPatients })}
        />
        <Kpi
          label={t('remindersDelivered')}
          value={String(analytics.delivery.push.delivered + analytics.delivery.email.delivered)}
          hint={t('ofDispatched', { count: analytics.reminders.dispatched })}
        />
        <Kpi
          label={t('adherence')}
          value={percent(analytics.adherenceRate, noData)}
          /*
            The exclusion travels with the number, like the hours-saved assumption below. A ratio
            whose denominator silently dropped rows is not a figure anyone can check, and this one
            may be shown to a patient.
          */
          hint={
            analytics.excludedUndelivered > 0
              ? t('adherenceExcludes', { count: analytics.excludedUndelivered })
              : t('confirmedOf', { done: analytics.reminders.done, total: answered })
          }
        />
        <Kpi
          label={t('hoursSaved')}
          value={`~${analytics.hoursSaved.hours}h`}
          /* The assumption travels with the number, or it is not a figure anyone can check. */
          hint={t('hoursAssumption', {
            perReminder: analytics.hoursSaved.minutesPerReminder,
            perPatient: analytics.hoursSaved.minutesPerPatient,
          })}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('delivery')}</h3>
        <DeliveryBar label={t('push')} rate={analytics.delivery.push} noData={noData} />
        <DeliveryBar label={t('email')} rate={analytics.delivery.email} noData={noData} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t('languages')}</h3>
        {analytics.locales.map(split => (
          <Bar
            key={split.locale}
            label={split.locale === 'ka' ? 'ქართული' : 'English'}
            value={`${split.count} · ${Math.round(split.share * 100)}%`}
            share={split.share}
          />
        ))}
      </section>
    </div>
  );
}
