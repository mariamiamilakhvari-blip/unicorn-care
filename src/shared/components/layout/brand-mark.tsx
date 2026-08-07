import Image from 'next/image';

import { APP_NAME } from '@/shared/const/app.const';
import { cn } from '@/shared/lib/utils';

type BrandMarkProps = {
  className?: string;
};

/**
 * The unicorn mark. Rendered from `/unicorn.svg` rather than inlined so a single file stays the
 * source of truth for the logo, the manifest icons, and anything else that needs it.
 *
 * `width`/`height` are the artwork's real 120×128 viewBox, not the rendered size: they are the
 * aspect ratio Next reserves space with. The mark is then sized by height in CSS, with `w-auto`
 * following it — a square `size` prop claimed a ratio the drawing does not have, and Tailwind's
 * preflight `height: auto` corrected it back at paint, which is what Next was warning about.
 *
 * Callers change the size by passing a height class; `cn` lets it replace the default.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Image
      src="/unicorn.svg"
      alt={APP_NAME}
      width={120}
      height={128}
      priority
      className={cn('h-7 w-auto shrink-0', className)}
    />
  );
}
