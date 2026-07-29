import Link from 'next/link';

import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';
import { Button } from '@/shared/components/ui/button';
import { FEATURE_PAGES, FeaturePage } from '@/shared/const/feature-page.const';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { AppLocale } from '@/shared/types/roles';

/**
 * One keyword cluster, one page. The sibling links at the bottom are not decoration: internal
 * links are how a crawler discovers these pages and how ranking authority reaches them from the
 * home page.
 */
export function FeaturePageView({ page, locale }: { page: FeaturePage; locale: AppLocale }) {
  const copy = page.content[locale];
  const prefix = locale === 'en' ? '/en' : '';
  const siblings = FEATURE_PAGES.filter(other => other.slug !== page.slug);
  const moreLabel = locale === 'en' ? 'More on Unicorn Care' : 'სხვა შესაძლებლობები';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 pb-16 pt-20 sm:px-10">
          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
            {copy.heading}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">{copy.lead}</p>

          <div className="mt-12 flex flex-col gap-10">
            {copy.sections.map(section => (
              <section key={section.heading}>
                <h2 className="font-heading text-xl font-semibold">{section.heading}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
              </section>
            ))}
          </div>

          <Button asChild className="mt-12">
            <Link href={`${prefix}${CLINIC_SIGN_UP_ROUTE}`}>{copy.ctaLabel}</Link>
          </Button>

          <nav aria-label={moreLabel} className="mt-16 border-t border-border pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {moreLabel}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {siblings.map(sibling => (
                <li key={sibling.slug}>
                  <Link
                    href={`${prefix}/features/${sibling.slug}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {sibling.content[locale].heading}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>

      <Footer />
    </div>
  );
}
