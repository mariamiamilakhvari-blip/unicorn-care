'use client';

import { RecoveryLogView } from '@/features/recovery-log/types/recovery-log.types';
import { PAIN_SCALE_MAX, SWELLING_LEVELS } from '@/shared/const/recovery-log.const';

type SparklineProps = {
  points: RecoveryLogView[];
  checkupDays: number[];
  painLabel: string;
  swellingLabel: string;
};

/** A square viewBox the SVG scales out of — the rendered size comes from CSS, never from here. */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 40;

/** Swelling is ordinal, so it plots on the same 0–10 axis as pain rather than a second one. */
function swellingValue(level: string): number {
  const index = SWELLING_LEVELS.indexOf(level as (typeof SWELLING_LEVELS)[number]);
  return index < 0 ? 0 : (index / (SWELLING_LEVELS.length - 1)) * PAIN_SCALE_MAX;
}

function toPath(points: RecoveryLogView[], value: (point: RecoveryLogView) => number): string {
  const lastDay = points[points.length - 1]?.dayIndex ?? 1;
  const span = Math.max(lastDay, 1);

  return points
    .map((point, index) => {
      const x = (point.dayIndex / span) * VIEW_WIDTH;
      // Inverted: SVG y grows downward, and more pain should read as higher on the chart.
      const y = VIEW_HEIGHT - (value(point) / PAIN_SCALE_MAX) * VIEW_HEIGHT;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * Pain and swelling over days since the procedure, with the checkups marked.
 *
 * Drawn as bare SVG rather than pulled from a charting library: two polylines and a few tick
 * marks do not justify a dependency, and the shape of the curve is the entire clinical signal —
 * axes, tooltips and legends would add furniture around a line whose direction is the point.
 *
 * Checkups are marked because the question a clinic actually asks of this chart is usually "what
 * did it look like around the time we saw them", and a curve with no appointments on it answers
 * only half of that.
 */
export function RecoverySparkline({
  points,
  checkupDays,
  painLabel,
  swellingLabel,
}: SparklineProps) {
  if (points.length < 2) return null;

  const lastDay = points[points.length - 1].dayIndex;
  const span = Math.max(lastDay, 1);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={`${painLabel} / ${swellingLabel}`}
      >
        {checkupDays
          .filter(day => day <= lastDay)
          .map(day => (
            <line
              key={day}
              x1={(day / span) * VIEW_WIDTH}
              x2={(day / span) * VIEW_WIDTH}
              y1={0}
              y2={VIEW_HEIGHT}
              className="stroke-border"
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
          ))}

        <path
          d={toPath(points, point => swellingValue(point.swelling))}
          fill="none"
          className="stroke-moss"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={toPath(points, point => point.painLevel)}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-4 rounded bg-primary" aria-hidden />
          {painLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-4 rounded bg-moss" aria-hidden />
          {swellingLabel}
        </span>
      </div>
    </div>
  );
}
