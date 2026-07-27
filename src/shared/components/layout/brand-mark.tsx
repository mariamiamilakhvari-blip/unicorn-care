import Image from 'next/image';

import { APP_NAME } from '@/shared/const/app.const';
import { cn } from '@/shared/lib/utils';

type BrandMarkProps = {
  className?: string;
  size?: number;
};

/**
 * The unicorn mark. Rendered from `/unicorn.svg` rather than inlined so a single file stays the
 * source of truth for the logo, the manifest icons, and anything else that needs it.
 */
export function BrandMark({ className, size = 28 }: BrandMarkProps) {
  return (
    <Image
      src="/unicorn.svg"
      alt={APP_NAME}
      width={size}
      height={size}
      priority
      className={cn('shrink-0', className)}
    />
  );
}
