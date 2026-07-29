'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { PRICING_ROUTE } from '@/shared/const/routes.const';

/**
 * The wall a clinic hit when a write was refused.
 *
 * These are answers from the server, not faults: a trial that ended and a plan that is full both
 * come back as a normal 4xx. Left unhandled they surfaced as a runtime error overlay, which reads
 * as "the app is broken" rather than "your subscription needs attention" and gives the clinic
 * nothing to act on.
 */
export type PatientWriteError = 'SUBSCRIPTION_INACTIVE' | 'PATIENT_LIMIT_REACHED' | 'GENERIC';

/** Both billing walls are fixed on the pricing page, so both get the same way out. */
const BILLING_ERRORS: PatientWriteError[] = ['SUBSCRIPTION_INACTIVE', 'PATIENT_LIMIT_REACHED'];

export function PatientWriteErrorNotice({ error }: { error: PatientWriteError }) {
  const t = useTranslations('patient');

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-destructive">{t(`writeError.${error}.title`)}</p>
        <p className="text-sm text-muted-foreground">{t(`writeError.${error}.body`)}</p>

        {BILLING_ERRORS.includes(error) && (
          <Button asChild size="sm" variant="outline" className="self-start">
            <Link href={PRICING_ROUTE}>{t('writeError.action')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Maps whatever the API returned onto a case with copy; anything unknown falls back to generic. */
export function toPatientWriteError(caught: unknown): PatientWriteError {
  const message = caught instanceof Error ? caught.message : '';
  if (BILLING_ERRORS.includes(message as PatientWriteError)) {
    return message as PatientWriteError;
  }
  return 'GENERIC';
}
