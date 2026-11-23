import type { Metadata } from 'next';
import { Oswald, Roboto } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { site } from '@/lib/site';

import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  icons: { icon: site.logo || '/site-icon.svg' },
};

const heading = Oswald({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });
const body = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-body', display: 'swap' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${heading.variable} ${body.variable}`} lang="es">
      <body className="flex min-h-dvh flex-col bg-paper font-sans text-zinc-900 antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
