'use client';

import { AlertTriangle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useSymptomReports } from '@/features/recovery-guide/hooks/use-symptom-reports';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';

/**
 * The clinic's review queue. Reports are listed newest first with no scoring or ranking — a
 * clinician decides what matters, the system only makes sure nothing goes unseen.
 */
export function SymptomReportQueue() {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { reports, openCount, isLoading, review } = useSymptomReports();
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-destructive" aria-hidden />
          {t('reportQueue')}
        </CardTitle>
        {openCount > 0 && <Badge variant="destructive">{openCount}</Badge>}
      </CardHeader>

      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noReports')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map(report => (
              <li key={report.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {report.warningTitle || t('freeTextReport')}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(report.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                {report.note && <p className="mt-1 text-sm text-muted-foreground">{report.note}</p>}
                {report.severity && (
                  <p className="mt-1 text-xs font-medium">{t(`severity.${report.severity}`)}</p>
                )}

                {report.status === 'needs_review' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={notes[report.id] ?? ''}
                      onChange={event =>
                        setNotes(current => ({ ...current, [report.id]: event.target.value }))
                      }
                      placeholder={t('clinicNotePlaceholder')}
                      aria-label={t('clinicNotePlaceholder')}
                      className="max-w-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void review(report.id, 'reviewed', notes[report.id] ?? '')}
                    >
                      {t('markReviewed')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void review(report.id, 'dismissed', notes[report.id] ?? '')}
                    >
                      {tCommon('cancel')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(`reportStatus.${report.status}`)}
                    {report.clinicNote ? ` · ${report.clinicNote}` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
