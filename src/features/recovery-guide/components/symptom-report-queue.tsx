'use client';

import { AlertTriangle, ArrowRight, Mail, MessageCircle, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useSymptomReports } from '@/features/recovery-guide/hooks/use-symptom-reports';
import { SymptomReportPatientView } from '@/features/recovery-guide/types/recovery-guide.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { ContactMethod } from '@/shared/const/recovery.const';
import { toDialNumber, whatsAppLink } from '@/shared/utils/phone';

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
                <ReportPatient
                  patient={report.patient}
                  contactMethod={report.contactMethod}
                  contactPhone={report.contactPhone}
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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

/**
 * Who filed the report, above the symptom rather than beside it.
 *
 * A card reading "temperature 39" and a timestamp told the clinic a fact it could not act on:
 * the first question anyone reading a review queue asks is whose symptom this is, and answering
 * it meant leaving the dashboard to go looking. The name, the number and the way to the record
 * are the three things that turn a notification into a phone call.
 *
 * The number dials. It is the action the severe end of this queue actually calls for, and a
 * clinician reading a red flag should not have to retype a phone number off the screen. Plain
 * text when the clinic holds none — a dead `tel:` link is worse than none, the same rule the
 * patient-facing panel follows.
 *
 * Both "erased" and "no longer exists" are said in words. The report outlives the identity around
 * it by design, so a blank line here would read as a bug in the page rather than as the record
 * having been erased under a data-subject request.
 */
type ReportPatientProps = {
  patient: SymptomReportPatientView | null;
  /** What the patient asked for on this report, not a standing preference on their record. */
  contactMethod: ContactMethod;
  /** Already resolved by the service: what they typed, else the number on their record. */
  contactPhone: string;
};

function ReportPatient({ patient, contactMethod, contactPhone }: ReportPatientProps) {
  const t = useTranslations('recoveryGuide');
  const chatUrl = contactMethod === 'whatsapp' ? whatsAppLink(contactPhone) : '';

  if (!patient) {
    return <p className="text-sm text-muted-foreground">{t('reportPatientMissing')}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <p className="text-sm font-medium">
        {patient.name ? t('reportPatient', { name: patient.name }) : t('reportPatientErased')}
      </p>

      {/*
        What the patient asked for, stated before the number rather than inferred from it. A
        clinician who rings a patient that asked to be messaged has not made a small mistake —
        someone recovering abroad may be asleep, roaming, or unable to take the call at all.
      */}
      <Badge variant="outline" className="gap-1.5">
        {contactMethod === 'whatsapp' ? (
          <MessageCircle className="size-3.5 shrink-0" aria-hidden />
        ) : contactMethod === 'email' ? (
          <Mail className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <PhoneCall className="size-3.5 shrink-0" aria-hidden />
        )}
        {t(`contactMethod.${contactMethod}`)}
      </Badge>

      {contactPhone ? (
        <a
          href={`tel:${toDialNumber(contactPhone)}`}
          className="inline-flex items-center gap-1.5 text-xs underline underline-offset-4"
        >
          <PhoneCall className="size-3.5 shrink-0" aria-hidden />
          {contactPhone}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">{t('reportNoPhone')}</span>
      )}

      {/*
        Beside the number, never instead of it. `whatsAppLink` returns nothing for a number it
        cannot turn into a real international one, and in that case the clinician still has the
        digits on screen to work from — a link that opens WhatsApp on the wrong person is worse
        than no link, and this queue is the one place that mistake costs the most.
      */}
      {chatUrl && (
        <a
          href={chatUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4"
        >
          <MessageCircle className="size-3.5 shrink-0" aria-hidden />
          {t('openWhatsApp')}
        </a>
      )}

      <Link
        href={`/dashboard/patients/${patient.id}`}
        className="inline-flex items-center gap-1.5 text-xs underline underline-offset-4"
      >
        {t('openPatient')}
        <ArrowRight className="size-3.5 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}
