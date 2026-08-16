'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { ConsentView } from '@/features/data-protection/types/data-protection.types';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ConsentType, PATIENT_REVOCABLE_CONSENTS } from '@/shared/const/consent-type.const';

type ConsentControlsProps = {
  consents: ConsentView[];
  pendingType: ConsentType | null;
  onChange: (type: ConsentType, granted: boolean) => void;
};

/**
 * What is being done with this patient's data, and the two things they can stop.
 *
 * Every revocable consent is rendered whether or not a record exists for it, which is the whole
 * reason the list is driven by `PATIENT_REVOCABLE_CONSENTS` rather than by the rows that came
 * back. A patient who has already withdrawn reminders needs to see reminders listed as off — a
 * screen that simply omitted them would leave them unable to tell whether the withdrawal worked
 * or whether the setting had never existed.
 *
 * The consents that are not revocable here are listed too, marked as such, with the route to
 * exercising them named. Hiding them would suggest the patient has fewer rights than they do.
 */
export function ConsentControls({ consents, pendingType, onChange }: ConsentControlsProps) {
  const t = useTranslations('privacy');
  const format = useFormatter();

  const held = new Map(consents.map(consent => [consent.type, consent]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('consentHeading')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('consentHelp')}</p>
        <ul className="flex flex-col gap-3">
          {PATIENT_REVOCABLE_CONSENTS.map(type => {
            const consent = held.get(type) ?? null;
            const isOn = consent !== null;

            return (
              <li
                key={type}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{t(`consent_${type}`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {isOn && consent
                      ? t('grantedOn', {
                        date: format.dateTime(new Date(consent.grantedAt), {
                          dateStyle: 'medium',
                        }),
                      })
                      : t('notGranted')}
                  </p>
                </div>
                <Button
                  variant={isOn ? 'outline' : 'default'}
                  size="sm"
                  disabled={pendingType === type}
                  onClick={() => onChange(type, !isOn)}
                  className="shrink-0"
                >
                  {isOn ? t('turnOff') : t('turnOn')}
                </Button>
              </li>
            );
          })}
        </ul>
        {/*
          The consents the patient cannot toggle here, and where they go instead. Withdrawing the
          basis for holding a clinical record is an erasure request weighed against the retention
          the Law on Health Care mandates, which is the form below rather than a switch.
        */}
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t('clinicalConsentNote')}
        </p>
      </CardContent>
    </Card>
  );
}
