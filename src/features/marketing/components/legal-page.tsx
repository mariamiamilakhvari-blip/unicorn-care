import { useLocale } from 'next-intl';

import { Footer } from '@/shared/components/layout/footer';
import { Header } from '@/shared/components/layout/header';
import { LegalSlug, legalDocument } from '@/shared/const/legal.const';
import { AppLocale } from '@/shared/types/roles';

/**
 * Renders whichever legal document it is handed.
 *
 * One component for both because they differ only in words: the same header, the same measure, the
 * same last-updated line. Splitting them would mean two places to change when the layout moves.
 *
 * A narrower column than the marketing pages — this is text nobody reads for pleasure, and the
 * one thing that makes it readable at all is a line length that does not force the eye to hunt
 * for the next row.
 */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const locale = useLocale() as AppLocale;
  const document = legalDocument(slug, locale);
  const updatedLabel = locale === 'en' ? 'Last updated' : 'ბოლო განახლება';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 pb-20 pt-16 sm:px-10">
          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
            {document.title}
          </h1>

          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {updatedLabel} {document.lastUpdated}
          </p>

          <p className="mt-8 text-base leading-relaxed text-muted-foreground">{document.intro}</p>

          <div className="mt-12 flex flex-col gap-10">
            {document.sections.map(section => (
              <section key={section.heading}>
                <h2 className="font-heading text-xl font-semibold">{section.heading}</h2>
                {section.paragraphs.map(paragraph => (
                  <p
                    key={paragraph}
                    className="mt-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
