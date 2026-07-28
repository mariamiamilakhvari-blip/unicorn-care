import { getTranslations } from 'next-intl/server';

import { PricingTable } from '@/features/clinic/components/pricing-table';

export default async function PricingPage() {
  const t = await getTranslations('pricing');

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
      </header>

      <PricingTable />

      <p className="text-xs text-muted-foreground">{t('footnote')}</p>
    </main>
  );
}
