import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { DPA_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE } from '@/shared/const/routes.const';

/**
 * The legal links live here as well as in the consent checkboxes. A visitor who has not reached
 * registration still has to be able to find the privacy policy, and a crawler needs a path to it
 * from every page — the checkbox on a form it cannot submit is not one.
 *
 * The labels were hardcoded English until now, on a product whose default locale is Georgian. That
 * left `Terms · Privacy · DPA` sitting under a page of Georgian copy, which is worse than untidy:
 * these are the documents a visitor is told they have agreed to, and a label in a language they
 * may not read is a link they will not follow. Routing them through `next-intl` also means the
 * English locale keeps English labels, rather than trading one hardcoded language for another.
 *
 * `useTranslations` rather than `getTranslations`: this is a Server Component but not an async
 * one, which is the same shape `home-page.tsx` already uses.
 */
export const Footer = () => {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-border px-6 py-6 sm:px-10">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link
          href={TERMS_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('terms')}
        </Link>
        <Link
          href={PRIVACY_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('privacy')}
        </Link>
        <Link
          href={DPA_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('dpa')}
        </Link>
      </nav>
    </footer>
  );
};
