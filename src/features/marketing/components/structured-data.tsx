import { APP_NAME } from '@/shared/const/app.const';
import { faqFor } from '@/shared/const/faq.const';
import { pageCopy, SITE_URL } from '@/shared/const/seo.const';
import { AppLocale } from '@/shared/types/roles';

/**
 * Schema.org JSON-LD for the landing page.
 *
 * `SoftwareApplication` is what earns the price and category treatment in a result; the `FAQPage`
 * entries are what can win the expanded answer box, which is why the questions are phrased the way
 * a clinic would actually type them.
 *
 * Rendered as a script tag rather than through `next/script`: it must be in the initial HTML for a
 * crawler that does not execute JavaScript.
 */
export function StructuredData({ locale }: { locale: AppLocale }) {
  const copy = pageCopy(locale, 'home');
  const isEnglish = locale === 'en';

  const faq = faqFor(locale);

  const graph = [
    {
      '@type': 'SoftwareApplication',
      name: APP_NAME,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      description: copy.description,
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '99',
        priceCurrency: 'USD',
        // Matches the Standard plan's monthly-equivalent annual rate on the pricing page.
        description: isEnglish ? 'Standard plan, billed annually' : 'Standard პაკეტი, წლიური გადახდა',
      },
      audience: {
        '@type': 'Audience',
        audienceType: isEnglish ? 'Plastic surgery clinics' : 'პლასტიკური ქირურგიის კლინიკები',
      },
    },
    {
      '@type': 'Organization',
      name: APP_NAME,
      url: SITE_URL,
      // Google's logo rich result wants a crawlable raster it can crop to a square. An SVG is
      // accepted by the parser but is not what the guidance asks for, so this points at the same
      // 512² PNG the manifest and the favicon are cut from.
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
    {
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Content is our own constants, never user input, so there is nothing here to escape.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
