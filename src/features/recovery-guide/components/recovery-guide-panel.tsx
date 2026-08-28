'use client';

import { AlertTriangle, CircleCheck, PhoneCall, Siren } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ConcernReportSection } from '@/features/recovery-guide/components/concern-report-section';
import { useRecoveryGuide } from '@/features/recovery-guide/hooks/use-recovery-guide';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
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
  const { guide, absence, isLoading } = useRecoveryGuide();

  if (isLoading) return null;

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
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/*
          Two different absences, and only one of them is worth a sentence.

          `missing` means nobody has written a guide for this procedure, which is true and worth
          saying. `untranslated` means one exists in the language the patient did not pick — and
          that used to be spelled out here, which put a paragraph about publication states on a
          screen a post-operative patient opened to find out whether their swelling is normal. It
          named a document they cannot read and asked them to chase it.

          So it says nothing now. Silence is not the same as claiming nobody wrote one: the
          concern form below is still there, which is the actually useful next step, and it reaches
          the same clinic.

          What must never happen instead is serving the other language. `resolveGuideService`
          refuses to, deliberately — clinic-authored clinical text in a language the reader did not
          choose is not guidance they can act on, and under a "when to contact the clinic" heading
          it is worse than showing nothing at all.
        */}
        {!guide && absence !== 'untranslated' && (
          <p className="text-sm text-muted-foreground">{t('noGuide')}</p>
        )}

        {/*
          One way in, at the foot of the guidance it refers to. The "I have this" button that used
          to sit on every warning sign and the separate free-text card at the bottom of the portal
          have both become this: the signs are one-tap choices inside it, so a patient can send a
          named symptom, a sentence of their own, or the two together as one message.
        */}
        <ConcernReportSection warnings={guide?.warning ?? []} />
      </CardContent>
    </Card>
  );
}
