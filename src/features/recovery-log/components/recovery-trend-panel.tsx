'use client';

import { useTranslations } from 'next-intl';

import { RecoverySparkline } from '@/features/recovery-log/components/recovery-sparkline';
import { useRecoveryTrend } from '@/features/recovery-log/hooks/use-recovery-trend';
import { RecoveryLogView } from '@/features/recovery-log/types/recovery-log.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * The clinic's view of a patient's own account of their recovery.
 *
 * Deliberately plain: a curve, and the entries behind it. Nothing is scored, ranked, flagged or
 * escalated. This is patient-reported data, not clinical assessment, and dressing it as triage
 * would be the same mistake the symptom-report queue exists to avoid — a number a patient typed
 * about their own pain is not a measurement, and an alert built on one would be noise a clinic
 * learns to ignore.
 */
export function RecoveryTrendPanel({ patientId }: { patientId: string }) {
  const t = useTranslations('recoveryLog');
  const tCommon = useTranslations('common');
  const { trend, isLoading } = useRecoveryTrend(patientId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('clinicTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('clinicHelp')}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

        {trend && trend.points.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noEntries')}</p>
        )}

        {trend && trend.points.length > 0 && (
          <>
            <RecoverySparkline
              points={trend.points}
              checkupDays={trend.checkupDays}
              painLabel={t('pain')}
              swellingLabel={t('swelling')}
            />
            <ul className="flex flex-col gap-2">
              {[...trend.points].reverse().map(point => (
                <TrendRow key={point.id} point={point} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrendRow({ point }: { point: RecoveryLogView }) {
  const t = useTranslations('recoveryLog');

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-medium">{t('dayLabel', { day: point.dayIndex })}</span>
        <span className="text-muted-foreground">
          {t('pain')} {point.painLevel} · {t(`swelling_${point.swelling}`)}
          {point.mood ? ` · ${t(`mood_${point.mood}`)}` : ''}
        </span>
      </div>
      {point.note && <p className="text-sm text-muted-foreground">{point.note}</p>}
      {point.photoIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('photosAttached', { count: point.photoIds.length })}
        </p>
      )}
    </li>
  );
}
