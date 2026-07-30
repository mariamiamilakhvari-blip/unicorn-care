import { useTranslations } from 'next-intl';

import { PricingPurchase } from '@/features/clinic/components/pricing-purchase';
import { PricingTable } from '@/features/clinic/components/pricing-table';
import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';

/**
 * The pricing page shell.
 *
 * It exists because the route file was rendering its own bare `<main>` with no `Header` and no
 * `Footer` — the only public page without them. A visitor who landed on pricing from search had
 * no link back to the home page, no sign-in and no language switch; the page was a cul-de-sac.
 * Every other public page reaches the header through a component like this one (`HomePage`,
 * `FeaturePageView`, `AuthPageShell`), so pricing now does too, and CLAUDE.md §0 keeps the
 * structural markup out of the route file.
 *
 * `hasClinic` arrives as a prop rather than being read here: the session lookup is a server
 * concern and belongs in the route, which keeps this component renderable in either locale.
 */
export function PricingPageView({ hasClinic }: { hasClinic: boolean }) {
  const t = useTranslations('pricing');

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
            <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
          </div>

          {/*
            A visitor is sent to sign-up; a clinic that already exists buys directly. Showing the
            sign-up version to a registered clinic was a dead end — every button led back to a
            registration form they had already completed.
          */}
          {hasClinic ? <PricingPurchase /> : <PricingTable />}

          <p className="text-xs text-muted-foreground">{t('footnote')}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
