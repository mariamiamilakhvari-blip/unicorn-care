import { Geist_Mono, Inter, Space_Grotesk } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { type ReactNode } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_THEME_COLOR } from '@/shared/const/app.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { ThemeProvider } from '@/shared/providers/theme-provider';

import type { Metadata, Viewport } from 'next';

import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
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
