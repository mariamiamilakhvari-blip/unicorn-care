'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

type TimesOfDayFieldProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

const MAX_TIMES = 6;

/**
 * Times are clinic-local wall clock ("08:00"), never instants — the generator converts them per
 * calendar day so a plan stays correct across a DST shift (PRD 03 §3).
 */
export function TimesOfDayField({ value, onChange }: TimesOfDayFieldProps) {
  const t = useTranslations('carePlan');

  function updateAt(index: number, next: string) {
    onChange(value.map((time, position) => (position === index ? next : time)));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('timesOfDay')}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((time, index) => (
          <div key={index} className="flex items-center gap-1">
            <Input
              type="time"
              value={time}
              onChange={event => updateAt(index, event.target.value)}
              className="w-32"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('removeTime')}
              onClick={() => onChange(value.filter((_, position) => position !== index))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}

        {value.length < MAX_TIMES && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, '08:00'])}>
            <Plus className="size-4" aria-hidden />
            {t('addTime')}
          </Button>
        )}
      </div>
    </div>
  );
}
