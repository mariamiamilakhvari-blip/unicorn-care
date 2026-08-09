'use client';

import { Check, Clock, Pill, Activity, CalendarCheck, Info, HeartPulse } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { IntensityChip } from '@/features/care-plan/components/intensity-chip';
import { PortalOccurrence } from '@/features/care-plan/types/portal.types';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

type OccurrenceCardProps = {
  occurrence: PortalOccurrence;
  onComplete: (id: string, outcome: 'done' | 'skipped') => void;
  isBusy: boolean;
};

const KIND_ICON: Record<PortalOccurrence['kind'], typeof Pill> = {
  medication: Pill,
  rehab: Activity,
  checkup: CalendarCheck,
  // An expected-sign notice from the recovery guide — information, not a task.
  guide: Info,
  // The one kind that asks the patient for something rather than telling them something.
  recovery_log: HeartPulse,
};

export function OccurrenceCard({ occurrence, onComplete, isBusy }: OccurrenceCardProps) {
  const t = useTranslations('portal');
  const format = useFormatter();
  const Icon = KIND_ICON[occurrence.kind];

  const isSettled = occurrence.status === 'done' || occurrence.status === 'skipped';

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card p-4',
        isSettled && 'opacity-60'
      )}
    >
      <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('font-medium', occurrence.status === 'done' && 'line-through')}>
            {occurrence.title}
          </p>
          {occurrence.intensity && <IntensityChip intensity={occurrence.intensity} />}
        </div>

        {occurrence.body && <p className="mt-1 text-sm text-muted-foreground">{occurrence.body}</p>}

        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {format.dateTime(new Date(occurrence.dueAt), { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {isSettled ? (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Check className="size-4" aria-hidden />
          {occurrence.status === 'done' ? t('done') : t('skipped')}
        </span>
      ) : (
        <div className="flex shrink-0 flex-col gap-2">
          <Button size="sm" disabled={isBusy} onClick={() => onComplete(occurrence.id, 'done')}>
            {t('markDone')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={() => onComplete(occurrence.id, 'skipped')}
          >
            {t('skip')}
          </Button>
        </div>
      )}
    </li>
  );
}
