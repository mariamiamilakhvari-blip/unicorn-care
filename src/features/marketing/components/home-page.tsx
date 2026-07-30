import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { AudienceSection } from '@/features/marketing/components/audience-section';
import { FaqSection } from '@/features/marketing/components/faq-section';
import { FeatureDeck } from '@/features/marketing/components/feature-deck';
import { StructuredData } from '@/features/marketing/components/structured-data';
import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';
import { Button } from '@/shared/components/ui/button';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { AppLocale } from '@/shared/types/roles';

export const HomePage = () => {
  const t = useTranslations('marketing');
  const locale = useLocale() as AppLocale;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StructuredData locale={locale} />
      <Header />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-20 sm:px-10 sm:pt-28">
          <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t('eyebrow')}
            </span>
          </div>

          {/*
            `break-words` is a floor, not a style choice. Georgian compounds like
            "პოსტოპერაციული" render wider than a 320px viewport at this size, and without it the
            whole page scrolls sideways. It only engages when a word genuinely cannot fit.
          */}
          <h1 className="animate-rise animate-rise-1 mt-6 max-w-3xl break-words text-4xl font-bold leading-tight sm:text-6xl">
            {t('headline')} <span className="text-primary">{t('headlineAccent')}</span>
          </h1>

          <p className="animate-rise animate-rise-2 mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('subheadline')}
          </p>

          <div className="animate-rise animate-rise-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild className="font-semibold">
              <Link href={CLINIC_SIGN_UP_ROUTE}>
                {t('ctaPrimary')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/sign-in">{t('ctaSecondary')}</Link>
            </Button>
          </div>
        </section>

        <FeatureDeck />

        {/* Below the feature deck: the body copy a search engine can actually read and rank. */}
        <AudienceSection locale={locale} />
        <FaqSection locale={locale} />
      </main>

      <Footer />
    </div>
  );
};
