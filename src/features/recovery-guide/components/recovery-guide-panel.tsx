'use client';

import { AlertTriangle, CircleCheck, PhoneCall, Siren } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useRecoveryGuide } from '@/features/recovery-guide/hooks/use-recovery-guide';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { WarningSeverity } from '@/shared/const/recovery.const';
import { cn } from '@/shared/lib/utils';

const SEVERITY_ICON: Record<WarningSeverity, typeof PhoneCall> = {
  call_clinic: PhoneCall,
  urgent: AlertTriangle,
  emergency: Siren,
};

/** Emergency reads loudest. Severity is the clinic's label, never something the app decided. */
const SEVERITY_CLASS: Record<WarningSeverity, string> = {
  call_clinic: 'border-border',
  urgent: 'border-primary-edge',
  emergency: 'border-destructive',
};

export function RecoveryGuidePanel() {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { guide, isLoading, isReporting, reportedAt, error, report } = useRecoveryGuide();
  const [note, setNote] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  if (isLoading) return null;

  async function flag(warningTitle: string, severity: string) {
    await report({ warningTitle, severity, note: '' });
    setIsFormOpen(false);
  }

  async function submitNote() {
    if (note.trim().length === 0) return;
    await report({ warningTitle: '', severity: '', note });
    setNote('');
    setIsFormOpen(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/*
          Standing, non-dismissible. This screen is reference material read unsupervised by a
          post-operative patient; it must never read as a substitute for calling someone.
        */}
        <p className="flex items-start gap-2 rounded-md border border-destructive p-3 text-xs">
          <Siren className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {t('emergencyBanner')}
        </p>

        {guide && guide.expected.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CircleCheck className="size-4 text-moss" aria-hidden />
              {t('expectedHeading')}
            </h3>
            <ul className="flex flex-col gap-2">
              {guide.expected.map(item => (
                <li key={item.title} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('dayRange', { from: item.fromDay, to: item.toDay })}
                  </p>
                  {item.description && <p className="mt-1 text-sm">{item.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {guide && guide.warning.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              {t('warningHeading')}
            </h3>
            <ul className="flex flex-col gap-2">
              {guide.warning.map(item => {
                const Icon = SEVERITY_ICON[item.severity];
                return (
                  <li
                    key={item.title}
                    className={cn('rounded-md border p-3', SEVERITY_CLASS[item.severity])}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <p className="mt-1 text-xs font-medium">{t(`severity.${item.severity}`)}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={isReporting}
                      onClick={() => void flag(item.title, item.severity)}
                    >
                      {t('flagThis')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!guide && <p className="text-sm text-muted-foreground">{t('noGuide')}</p>}

        <section className="flex flex-col gap-2">
          {reportedAt ? (
            <p className="text-sm font-medium text-moss">{t('reportSent')}</p>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(open => !open)}>
              {t('somethingWrong')}
            </Button>
          )}

          {isFormOpen && !reportedAt && (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={3}
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder={t('describePlaceholder')}
                aria-label={t('describePlaceholder')}
              />
              <Button
                type="button"
                disabled={isReporting || note.trim().length === 0}
                onClick={() => void submitNote()}
                className="self-start"
              >
                {isReporting ? tCommon('loading') : t('sendToClinic')}
              </Button>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{tCommon('error')}</p>}
        </section>
      </CardContent>
    </Card>
  );
}
