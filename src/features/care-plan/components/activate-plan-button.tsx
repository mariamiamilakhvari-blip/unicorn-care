'use client';

import { useTranslations } from 'next-intl';

import { useReachability } from '@/features/patient/hooks/use-reachability';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';

type ActivatePlanButtonProps = {
  patientId: string;
  isDisabled: boolean;
  onActivate: () => Promise<void>;
};

/**
 * Activation is the moment reminders start existing, so it is a separate deliberate act.
 *
 * When the patient has no way to receive them it asks first. Activating a plan for someone with
 * no address and no push subscription produces a schedule that looks alive from the clinic's side
 * — occurrences generated, dispatcher reporting them handled, adherence counting doses — while
 * the patient is told nothing at all. This is the last moment before that starts, and the point
 * where the missing detail is cheapest to collect.
 *
 * It warns rather than blocks. A clinic may well be phoning this patient, and the plan is still
 * theirs to run; refusing outright would be the tool overruling a clinical decision on the
 * strength of a missing field.
 */
export function ActivatePlanButton({
  patientId,
  isDisabled,
  onActivate,
}: ActivatePlanButtonProps) {
  const t = useTranslations('carePlan');
  const { reachability } = useReachability(patientId);

  const trigger = (
    <Button type="button" variant="outline" disabled={isDisabled}>
      {t('activatePlan')}
    </Button>
  );

  // Reachable, or not yet known: activation stays one click, as it was.
  if (!reachability || reachability.isReachable) {
    return (
      <Button type="button" variant="outline" disabled={isDisabled} onClick={() => void onActivate()}>
        {t('activatePlan')}
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={trigger}
      title={t('activateUnreachableTitle')}
      description={
        reachability.reason === 'EMAIL_SUPPRESSED'
          ? t('activateUnreachableSuppressed')
          : t('activateUnreachableNoContact')
      }
      confirmLabel={t('activateAnyway')}
      onConfirm={onActivate}
    />
  );
}
