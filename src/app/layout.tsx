import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { type ReactNode } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_THEME_COLOR } from '@/shared/const/app.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { ThemeProvider } from '@/shared/providers/theme-provider';

import type { Metadata, Viewport } from 'next';

import './globals.css';

/*
  Self-hosted rather than fetched from Google at build time.

  `next/font/google` downloads the font files during the build and generates a CSS module from
  them. When that request fails the module is never emitted and the build dies on a
  `module-not-found` for a file nobody wrote — which is what took a Vercel production deploy down
  on a commit that had built successfully minutes earlier, and which no amount of correct
  configuration prevents. Serving the files from the repository removes the network from the build
  entirely: the same input now always produces the same output.

  All four are variable fonts, one file each. The static cuts this replaces were eleven files for
  the three Latin families alone; the whole set including Georgian is now ~132 KB.

  Georgian is a separate family because it has to be. Neither Inter nor Space Grotesk contains a
  single Mkhedruli glyph, so every Georgian word on this Georgian-first product was rendering in
  whatever the operating system happened to pick — a different typeface per visitor, on the
  majority of the copy. Noto Sans Georgian covers the script properly, and CSS resolves it per
  glyph: Latin is drawn from Inter, Georgian falls through to Noto, from one `font-family`. The
  stacks that do this live in `globals.css`.
*/
const inter = localFont({
  src: './fonts/inter-latin-var.woff2',
  variable: '--font-inter',
  // The variable axis range, not a single cut — one file answers every weight the design uses.
  weight: '100 900',
  display: 'swap',
});

const spaceGrotesk = localFont({
  src: './fonts/space-grotesk-latin-var.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/geist-mono-latin-var.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

/** Mkhedruli for the headings and the body copy alike — neither Latin face has the script. */
const notoSansGeorgian = localFont({
  src: './fonts/noto-sans-georgian-var.woff2',
  variable: '--font-georgian',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  /*
    Set at the root so every page inherits it. Without it Next resolves OpenGraph image URLs
    against localhost, and a shared link renders with a broken preview in production.
  */
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: '%s' },
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
};

export const viewport: Viewport = { themeColor: APP_THEME_COLOR };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} ${notoSansGeorgian.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
