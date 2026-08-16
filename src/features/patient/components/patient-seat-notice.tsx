'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { Button } from '@/shared/components/ui/button';
import { PRICING_ROUTE } from '@/shared/const/routes.const';

/**
 * The wall, shown *before* it is hit.
 *
 * `PatientWriteErrorNotice` explains a refusal after the fact, which meant a clinic filled in a
 * whole intake form — name, allergies, four consent boxes — and only then learned there was no
 * seat for it. This says so while the form is still closed.
 *
 * Renders nothing in the ordinary case: a clinic with room and a live subscription sees no
 * billing furniture on a clinical page.
 */
export function PatientSeatNotice({ subscription }: { subscription: SubscriptionView }) {
  const t = useTranslations('patient');

  const isBlocked = !subscription.canWrite || subscription.isAtPatientLimit;
  if (!isBlocked) return null;

  const reason = subscription.canWrite ? 'PATIENT_LIMIT_REACHED' : 'SUBSCRIPTION_INACTIVE';

  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-destructive">{t(`writeError.${reason}.title`)}</p>
        <p className="text-sm text-muted-foreground">{t(`writeError.${reason}.body`)}</p>
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href={PRICING_ROUTE}>{t('writeError.action')}</Link>
        </Button>
      </div>
    </div>
  );
}
