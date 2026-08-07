import { ReactNode } from 'react';

import { ServiceWorkerRegister } from '@/features/notifications/components/service-worker-register';
import { BrandMark } from '@/shared/components/layout/brand-mark';
import { LanguageSwitcher } from '@/shared/components/layout/language-switcher';
import { APP_NAME } from '@/shared/const/app.const';

type PortalShellProps = {
  title: string;
  children: ReactNode;
};

/**
 * Deliberately its own shell, not the dashboard one — the portal is a phone-first PWA surface
 * with no navigation, so nothing on it can lead a patient into clinic screens.
 */
export function PortalShell({ title, children }: PortalShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <ServiceWorkerRegister />
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10" />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {APP_NAME}
            </p>
            <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          </div>
        </div>
        <LanguageSwitcher className="shrink-0" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
