import { getTranslations } from 'next-intl/server';

import { PricingPurchase } from '@/features/clinic/components/pricing-purchase';
import { PricingTable } from '@/features/clinic/components/pricing-table';
import { auth } from '@/shared/lib/auth';

type SessionUser = { clinicId?: string | null };

export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/*
        A visitor is sent to sign-up; a clinic that already exists buys directly. Showing the
        sign-up version to a registered clinic was a dead end — every button led back to a
        registration form they had already completed.
      */}
      {user?.clinicId ? <PricingPurchase /> : <PricingTable />}

      <p className="text-xs text-muted-foreground">{t('footnote')}</p>
    </main>
  );
}
