import { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * The typography every section heading on the care plan page shares.
 *
 * That page is a stack of sections assembled from different places — some are card headers, some
 * are headings inside the plan form — and each brought the size, face and tracking of whatever it
 * was built from. Read top to bottom the result looked like a hierarchy that was never designed:
 * "Medications" sat a step above "Procedures" for no reason beyond which component rendered it.
 *
 * It matches `CardTitle`, rather than the reverse, because the card-based sections were already
 * the majority and the smaller of the two. `font-sans` and `tracking-normal` are here to override
 * the base rule that hands every h1/h2/h3 the display face and tight tracking; `leading-none` is
 * what `CardTitle` sets. An <h2> is still the right element — this levels the styling of the
 * sections, not the document outline.
 *
 * There is deliberately no second level below this. "What is normal" and "When to contact the
 * clinic" were once nested under a "Complications and what is normal" wrapper and styled a step
 * down; the wrapper only ever held those two, so it added a level of hierarchy without adding
 * information. They are sections in their own right now, at this size, like every other one.
 */
export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('font-sans text-base leading-none font-semibold tracking-normal', className)}
      {...props}
    />
  );
}
