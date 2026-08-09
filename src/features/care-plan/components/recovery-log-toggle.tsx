'use client';

import { useTranslations } from 'next-intl';
import { Control, useController } from 'react-hook-form';

import { CarePlanFormType } from '@/features/care-plan/types/care-plan-form.types';
import { Checkbox } from '@/shared/components/ui/checkbox';

/**
 * Whether this plan asks the patient how recovery is going.
 *
 * Off unless a clinician ticks it, and worth stating plainly in the label why: turning it on adds
 * a recurring evening notification to a patient's phone for the length of their recovery. That is
 * a change to what the clinic asks of them, so it should be a decision somebody made rather than
 * something that arrived with a deployment.
 */
export function RecoveryLogToggle({ control }: { control: Control<CarePlanFormType> }) {
  const t = useTranslations('carePlan');
  const { field } = useController({ control, name: 'recoveryLogEnabled' });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <Checkbox
        id="recovery-log-enabled"
        checked={field.value === true}
        onCheckedChange={checked => field.onChange(checked === true)}
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="recovery-log-enabled">
          {t('recoveryLogEnabled')}
        </label>
        <p className="text-sm text-muted-foreground">{t('recoveryLogEnabledHelp')}</p>
      </div>
    </div>
  );
}
