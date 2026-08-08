'use client';

import { Star } from 'lucide-react';

import { RATING_SCALE } from '@/shared/const/rating.const';
import { cn } from '@/shared/lib/utils';

type ScorePickerProps = {
  label: string;
  value: number | null;
  onChange: (score: number) => void;
  /** Read out by screen readers as "3 of 5" once a score is chosen. */
  describeScore: (score: number) => string;
};

/**
 * Five buttons, not a slider.
 *
 * A radiogroup rather than a row of icons: a patient on a phone, days out of surgery and possibly
 * on painkillers, needs targets they can hit and a keyboard path that works. The stars are
 * decoration over real buttons, and every one carries its own label.
 */
export function ScorePicker({ label, value, onChange, describeScore }: ScorePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {RATING_SCALE.map(score => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={describeScore(score)}
            onClick={() => onChange(score)}
            className={cn(
              'rounded-md p-2 transition-colors',
              'hover:bg-moss/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value !== null && score <= value ? 'text-moss' : 'text-muted-foreground'
            )}
          >
            <Star
              className={cn('size-7', value !== null && score <= value && 'fill-current')}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
