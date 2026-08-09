'use client';

import { PAIN_SCALE_MAX, PAIN_SCALE_MIN } from '@/shared/const/recovery-log.const';
import { cn } from '@/shared/lib/utils';

type PainScaleProps = {
  value: number | null;
  onChange: (level: number) => void;
  label: string;
  lowLabel: string;
  highLabel: string;
};

const LEVELS = Array.from(
  { length: PAIN_SCALE_MAX - PAIN_SCALE_MIN + 1 },
  (_unused, index) => PAIN_SCALE_MIN + index
);

/**
 * The 0–10 scale, as eleven buttons.
 *
 * A row of numbers rather than a slider: a patient on painkillers, on a phone, needs targets they
 * can hit and a value they can read back. A slider gives neither, and a slider with no default
 * position cannot express "I have not answered yet" at all.
 */
export function PainScale({ value, onChange, label, lowLabel, highLabel }: PainScaleProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {LEVELS.map(level => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            onClick={() => onChange(level)}
            className={cn(
              'size-9 rounded-md border text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === level
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            )}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
