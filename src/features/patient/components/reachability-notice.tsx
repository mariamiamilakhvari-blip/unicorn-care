'use client';

import { MailWarning } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useReachability } from '@/features/patient/hooks/use-reachability';

/**
 * Says, on the patient's own page, that nothing sent to them is arriving.
 *
 * A patient with no address and no push subscription receives no reminder, ever — and until this
 * existed nothing anywhere said so. The plan looked active, the dispatcher reported every
 * reminder handled, and the adherence figures counted doses nobody was ever told about.
 *
 * Deliberately not a warning about the *system*. It names the missing detail and what it costs,
 * because the fix is the clinic asking the patient for an address, and a message that only says
 * "delivery problem" does not prompt anyone to do that.
 */
export function ReachabilityNotice({ patientId }: { patientId: string }) {
  const t = useTranslations('patient');
  const { reachability, isLoading } = useReachability(patientId);

  if (isLoading || !reachability || reachability.isReachable) return null;

  const body =
    reachability.reason === 'EMAIL_SUPPRESSED' ? t('unreachableSuppressed') : t('unreachableNoContact');

  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive p-4">
      <MailWarning className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t('unreachableTitle')}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
