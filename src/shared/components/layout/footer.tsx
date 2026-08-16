import Link from 'next/link';

import { DPA_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE } from '@/shared/const/routes.const';

/**
 * The legal links live here as well as in the consent checkboxes. A visitor who has not reached
 * registration still has to be able to find the privacy policy, and a crawler needs a path to it
 * from every page — the checkbox on a form it cannot submit is not one.
 */
export const Footer = () => {
  return (
    <footer className="border-t border-border px-6 py-6 sm:px-10">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link
          href={TERMS_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Terms
        </Link>
        <Link
          href={PRIVACY_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Privacy
        </Link>
        <Link
          href={DPA_ROUTE}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          DPA
        </Link>
      </nav>
    </footer>
  );
};
