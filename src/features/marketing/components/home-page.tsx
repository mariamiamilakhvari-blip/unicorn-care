import { Activity, ArrowRight, Bell, Pill, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { AudienceSection } from '@/features/marketing/components/audience-section';
import { FaqSection } from '@/features/marketing/components/faq-section';
import { StructuredData } from '@/features/marketing/components/structured-data';
import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { HOME_FEATURES, HOME_STAT_KEYS, type HomeFeatureIcon } from '@/shared/const/home.const';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { AppLocale } from '@/shared/types/roles';

const FEATURE_ICON_MAP: Record<HomeFeatureIcon, LucideIcon> = {
  pill: Pill,
  bell: Bell,
  activity: Activity,
};

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

          <h1 className="animate-rise animate-rise-1 mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
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

          <dl className="animate-rise animate-rise-4 mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {HOME_STAT_KEYS.map((key) => (
              <div key={key} className="bg-background px-5 py-4">
                <dt className="font-heading text-xl font-bold tracking-tight">
                  {t(`stats.${key}.value`)}
                </dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">{t(`stats.${key}.label`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label={t('featuresEyebrow')} className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('featuresEyebrow')}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HOME_FEATURES.map((feature) => {
              const Icon = FEATURE_ICON_MAP[feature.icon];

              return (
                <Card
                  key={feature.key}
                  className="gap-0 transition-colors duration-300 hover:border-primary/40"
                >
                  <CardHeader className="pb-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {t(`features.${feature.key}.label`)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <h3 className="text-lg font-bold">{t(`features.${feature.key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`features.${feature.key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Below the feature grid: the body copy a search engine can actually read and rank. */}
        <AudienceSection locale={locale} />
        <FaqSection locale={locale} />
      </main>

      <Footer />
    </div>
  );
};
