import { ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * The typography every top-level section heading on the care plan page shares.
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
 */
export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('font-sans text-base leading-none font-semibold tracking-normal', className)}
      {...props}
    />
  );
}

/**
 * A heading for a block nested inside a section, one step below `SectionTitle`.
 *
 * "What is normal" and "When to contact the clinic" are halves of "Complications and what is
 * normal". At the same size as their parent they read as three sibling sections instead of one
 * section with two parts, which is the specific confusion this size gap exists to prevent.
 */
export function SubsectionTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('font-sans text-sm leading-none font-semibold tracking-normal', className)}
      {...props}
    />
  );
}
