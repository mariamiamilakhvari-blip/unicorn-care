'use client';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Sidebar } from '@/shared/components/layout/sidebar';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

type DashboardShellProps = {
  children: ReactNode;
};

export const DashboardShell = ({ children }: DashboardShellProps) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Mobile toolbar — visible below lg */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={t('openNavigation')}
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{t('menu')}</span>
      </div>

      {/* Desktop static sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile off-canvas drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label={t('closeNavigation')}
          onClick={() => setOpen(false)}
          className={cn(
            'absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none',
            open ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">{t('navigation')}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label={t('closeNavigation')}
            >
              <X className="size-5" />
            </Button>
          </div>
          <Sidebar
            className="w-full flex-1 border-r-0"
            onNavigate={() => setOpen(false)}
          />
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
};
