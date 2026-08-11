'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ComponentProps, useState } from 'react';

import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

/**
 * A password field that can be read back.
 *
 * Typing a password blind is where sign-in attempts go to die, and this app hands out credentials
 * to clinic staff who are often on a phone. Visibility is per-field local state and starts hidden:
 * it never persists, so a revealed password cannot survive a navigation or be restored on a shared
 * machine.
 *
 * `type` is deliberately not accepted — the whole point of the component is that it owns it. Every
 * other prop is forwarded to the input rather than the wrapper, which is what keeps `FormControl`
 * working: it clones this element with the `id` and `aria-*` that tie the label, the description
 * and the error message to the field, and all of those belong on the input itself.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const t = useTranslations('common');
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      {/* Room for the button, so a long password never runs underneath it. */}
      <Input {...props} type={isVisible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        onClick={() => setIsVisible(current => !current)}
        // The label states what the button will do, not what the field is doing, and
        // `aria-pressed` carries the current state — a screen reader needs both.
        aria-label={isVisible ? t('hidePassword') : t('showPassword')}
        aria-pressed={isVisible}
        className={cn(
          'absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-muted-foreground',
          'transition-colors hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
