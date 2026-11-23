import type { Metadata } from 'next';
import { Oswald, Roboto } from 'next/font/google';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { siteUrl } from '@/lib/seo';
import { site } from '@/lib/site';

import './globals.css';

export const dynamic = 'force-dynamic';

// Every page's <title> is `<its metadata.title> Â· <site name>`; canonical URLs and social images resolve on siteUrl().
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteUrl()),
    title: { default: site.name, template: `%s Â· ${site.name}` },
    description: site.description,
    // the logo, else the name's initials on the brand colour (src/app/site-icon.svg): every site has an icon
    icons: { icon: site.logo || '/site-icon.svg' },
  };
}

// Oswald: tÃ­tulos, cifras grandes de horas y stock, cabeceras. Roboto: cuerpo, formularios y tablas.
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
