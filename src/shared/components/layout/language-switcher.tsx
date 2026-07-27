'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { Button } from '@/shared/components/ui/button';
import { LOCALE_OPTIONS } from '@/shared/const/locale.const';
import { setLocaleAction } from '@/shared/lib/locale-action';
import { cn } from '@/shared/lib/utils';

type LanguageSwitcherProps = {
  className?: string;
};

/**
 * Two locales, so a segmented pair beats a dropdown — one tap to switch, and the option not in use
 * stays readable rather than hidden behind a menu.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const active = useLocale();
  const t = useTranslations('common');
  const [isPending, startTransition] = useTransition();

  function select(locale: string) {
    if (locale === active || isPending) return;
    startTransition(() => {
      void setLocaleAction(locale);
    });
  }

  return (
    <div
      className={cn('flex items-center gap-1 rounded-md border border-border p-0.5', className)}
      role="group"
      aria-label={t('language')}
    >
      <Languages className="ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {LOCALE_OPTIONS.map(option => {
        const isActive = option.value === active;

        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={isActive}
            disabled={isPending}
            onClick={() => select(option.value)}
            className={cn(
              'h-7 px-2 text-xs font-medium',
              isActive
                ? 'bg-primary/10 text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
