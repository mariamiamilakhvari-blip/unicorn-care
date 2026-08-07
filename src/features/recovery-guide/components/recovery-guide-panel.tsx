'use client';

import { AlertTriangle, CircleCheck, PhoneCall, Siren } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
  const locale = useLocale();
  const { guide, absence, isLoading, isReporting, reportedAt, error, report } = useRecoveryGuide();
  /** Two languages, so "the one they are not reading" is the other one. */
  const otherLocale = locale === 'ka' ? 'en' : 'ka';
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
                    {/*
                      One row, wrapping. The call link and the report button are two different
                      actions and must not read as one control — `gap-x-4` keeps them apart on a
                      wide screen, and the wrap drops the button onto its own line on a narrow one
                      rather than squeezing it against the phone number.
                    */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {/*
                        The severity label doubles as the action when a phone number exists: a
                        patient reading "call your clinic" with a post-operative symptom in front
                        of them should not then have to go and find the number. Plain text when
                        the clinic has not supplied one — a dead `tel:` link is worse than none.
                      */}
                      {guide.clinic.phone ? (
                        <a
                          href={`tel:${guide.clinic.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4"
                        >
                          <PhoneCall className="size-3.5 shrink-0" aria-hidden />
                          {t(`severity.${item.severity}`)}
                          <span className="text-muted-foreground">{guide.clinic.phone}</span>
                        </a>
                      ) : (
                        <p className="text-xs font-medium">{t(`severity.${item.severity}`)}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isReporting}
                        onClick={() => void flag(item.title, item.severity)}
                      >
                        {t('flagThis')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/*
          Two different facts, said differently. A patient whose clinic wrote this guidance in
          Georgian last week must not be told nobody has written it — they would stop looking, and
          the useful next step (ask the clinic, or read it in the other language) never occurs to
          them. `otherLocale` is derivable because the product has exactly two languages; a third
          would make this a value the API has to send.
        */}
        {!guide && absence === 'untranslated' && (
          <p className="text-sm text-muted-foreground">
            {t('notTranslated', { language: t(`language.${otherLocale}`) })}
          </p>
        )}

        {!guide && absence !== 'untranslated' && (
          <p className="text-sm text-muted-foreground">{t('noGuide')}</p>
        )}

        <section className="flex flex-col gap-2">
          {reportedAt ? (
            <p className="text-sm font-medium text-moss">{t('reportSent')}</p>
          ) : (
            /*
              Destructive styling and an icon, not the outline used by every other control here.
              This is the escalation path: a patient who cannot find their symptom in the list
              above must be able to spot it at a glance, one-handed, possibly frightened.
            */
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="w-full gap-2 font-semibold"
              onClick={() => setIsFormOpen(open => !open)}
            >
              <AlertTriangle className="size-5 shrink-0" aria-hidden />
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
