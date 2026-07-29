import { faqFor } from '@/shared/const/faq.const';
import { AppLocale } from '@/shared/types/roles';

/**
 * The visible half of the `FAQPage` structured data.
 *
 * Both read `faqFor`, so what a crawler is told and what a visitor sees can never drift — Google
 * drops rich results when they do. Plain `<h3>`/`<p>` rather than an accordion, so the answers are
 * in the HTML without needing JavaScript to expand them.
 */
export function FaqSection({ locale }: { locale: AppLocale }) {
  const entries = faqFor(locale);
  const heading = locale === 'en' ? 'Frequently asked questions' : 'ხშირად დასმული კითხვები';

  return (
    <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10">
      <h2 id="faq-heading" className="font-heading text-2xl font-semibold sm:text-3xl">
        {heading}
      </h2>

      <dl className="mt-8 flex flex-col gap-6">
        {entries.map(entry => (
          <div key={entry.question} className="border-t border-border pt-6">
            <dt className="text-base font-semibold">{entry.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
