import { ReactNode } from 'react';

import { ServiceWorkerRegister } from '@/features/notifications/components/service-worker-register';
import { PortalIdentity } from '@/features/patient/components/portal-identity';
import { BrandMark } from '@/shared/components/layout/brand-mark';
import { LanguageSwitcher } from '@/shared/components/layout/language-switcher';
import { APP_NAME } from '@/shared/const/app.const';

type PortalShellProps = {
  title: string;
  /** Whose plan is on screen. Empty string for an erased record; the strip says so itself. */
  patientName: string;
  children: ReactNode;
};

/**
 * Deliberately its own shell, not the dashboard one — the portal is a phone-first PWA surface
 * with no navigation, so nothing on it can lead a patient into clinic screens.
 */
export function PortalShell({ title, patientName, children }: PortalShellProps) {
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
      {/*
        Above the plan, on every portal screen. A patient has to be able to answer "is this mine"
        before they read a dose, not after — see `PortalIdentity` for why the default case is a
        device still holding the previous patient's session.
      */}
      <PortalIdentity patientName={patientName} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
