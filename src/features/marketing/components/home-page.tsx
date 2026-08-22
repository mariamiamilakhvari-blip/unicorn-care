import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { AudienceSection } from '@/features/marketing/components/audience-section';
import { BenefitCards } from '@/features/marketing/components/benefit-cards';
import { FaqSection } from '@/features/marketing/components/faq-section';
import { StructuredData } from '@/features/marketing/components/structured-data';
import { TopRatedSection } from '@/features/marketing/components/top-rated-section';
import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';
import { Button } from '@/shared/components/ui/button';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { cn } from '@/shared/lib/utils';
import { AppLocale } from '@/shared/types/roles';

export const HomePage = () => {
  const t = useTranslations('marketing');
  const locale = useLocale() as AppLocale;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StructuredData locale={locale} />
      <Header />

      <main className="flex-1">
        {/*
          `min-h-screen` is a floor, never a cap: the hero still grows with its content, so the
          Georgian headline — which wraps to more lines than the English one — is never clipped.
          It exists because the two locales otherwise disagree about where the fold lands. English
          copy is shorter, so the hero collapsed and the benefit cards below crested the fold on a
          laptop; Georgian pushed them under it. The floor makes the first screen read the same in
          both languages.

          The floor is the whole job — the section stays a block. Making it a flex column instead
          stretched every child to the container width, which is not what `inline-flex` on the
          eyebrow pill looks like it should do, and centring the column on a screen-tall section
          dropped the headline well below where it reads.
        */}
        <section className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-16 pt-12 sm:px-10 sm:pt-16">
          <div className="animate-rise inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1">
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
          {/*
            Two steps down the scale for Georgian only. The same sentence is far longer set in
            Georgian than in English — it wraps to four lines at the English size and pushed the
            CTA off the first screen. English keeps the display size it was designed at; the two
            locales are sized to occupy the same space, not to use the same class.
          */}
          <h1
            className={cn(
              'animate-rise animate-rise-1 mt-6 max-w-3xl break-words font-bold',
              locale === 'ka' ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-6xl',
              // Last on purpose: tailwind-merge counts `text-*` as conflicting with `leading-*`,
              // so a leading class written before the size is dropped from the output entirely.
              'leading-tight'
            )}
          >
            {t('headline')} <span className="text-primary">{t('headlineAccent')}</span>
          </h1>

          <p className="animate-rise animate-rise-2 mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('subheadline')}
          </p>

          <p className="animate-rise animate-rise-3 mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('subheadlineSupport')}
          </p>

          <div className="animate-rise animate-rise-4 mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild className="font-semibold">
              <Link href={CLINIC_SIGN_UP_ROUTE}>
                {t('ctaPrimary')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {/*
              Filled indigo rather than outlined. An outline button draws its shape from the border
              alone, and on a near-white surface that reads as an empty box beside a solid sage one
              — the pair stopped looking like two choices. `secondary` is the indigo fill.
            */}
            <Button variant="secondary" size="lg" asChild>
              <Link href="/sign-in">{t('ctaSecondary')}</Link>
            </Button>
          </div>
        </section>

        {/* The payoff: what the product does for a clinic, before the audience and the FAQ. */}
        <BenefitCards />

        {/*
          Social proof, and the only section here whose content comes from the database. Renders
          nothing until a clinic has cleared the rating threshold, so an early-stage deployment
          shows the page it always showed rather than an empty board.
        */}
        <TopRatedSection />


        {/* Below the feature deck: the body copy a search engine can actually read and rank. */}
        <AudienceSection locale={locale} />
        <FaqSection locale={locale} />
      </main>

      <Footer />
    </div>
  );
};
