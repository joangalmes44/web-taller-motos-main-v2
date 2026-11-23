import Link from 'next/link';

import { Logo } from '@/components/icons';
import { SalirButton } from '@/components/salir-button';
import { currentRol, NAV_POR_ROL, ROL_NOMBRE } from '@/lib/roles';
import { hasShell, site } from '@/lib/site';

const link =
  'rounded-sm px-3 py-2 font-display text-sm font-medium uppercase tracking-wide text-zinc-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent';
const cta =
  'inline-flex items-center justify-center rounded-sm border-2 border-white bg-signal px-2.5 py-2 font-display text-xs sm:px-3.5 sm:text-sm font-semibold uppercase tracking-wide text-white shadow-[3px_3px_0_0_var(--color-accent)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

// El encabezado de todas las rutas (lo renderiza layout.tsx). Con sesión muestra los links del rol y su sello;
// sin sesión, los links públicos, «Ingresar» y «Reservar hora» destacado.
export async function SiteHeader() {
  if (!hasShell()) return null;
  const accounts: boolean = site.accounts;
  const actual = accounts ? await currentRol() : null;
  const session = actual?.session ?? null;
  const rol = session ? actual?.rol ?? null : null;
  const base = rol ? NAV_POR_ROL[rol] : site.nav;
  // «Reservar hora» va destacado para el público y el cliente; el resto de los links, normales
  const showCta = !session || rol === 'cliente';
  const links = showCta ? base.filter((l) => l.href !== '/reservar') : base;

  const sello = rol ? (
    <span className="inline-flex items-center rounded-xs border-2 border-accent px-2 py-0.5 font-display text-xs font-semibold uppercase leading-5 tracking-wider text-accent">
      {ROL_NOMBRE[rol]}
    </span>
  ) : null;
  const items = (
    <>
      {links.map((l) => (
        <Link className={link} href={l.href} key={l.href}>
          {l.label}
        </Link>
      ))}
      {!accounts ? null : session ? (
        <SalirButton className={`${link} text-left`} />
      ) : (
        <>
          <Link className={link} href="/login">
            Ingresar
          </Link>
          <Link className={link} href="/register">
            Crear cuenta
          </Link>
        </>
      )}
    </>
  );
  return (
    <header className="sticky top-0 z-20 bg-brand text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link aria-label={`${site.name}, inicio`} className="shrink-0" href="/">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {items}
          {sello ? <span className="ml-2">{sello}</span> : null}
        </nav>
        <div className="flex items-center gap-2">
          {showCta && (
            <Link className={cta} href="/reservar">
              Reservar hora
            </Link>
          )}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Menú"
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-sm border-2 border-white/30 text-white transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden"
            >
              <svg
                aria-hidden
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav
              aria-label="Menú"
              className="absolute right-0 mt-3 grid w-64 gap-1 border-2 border-accent bg-brand p-2 shadow-[5px_5px_0_0_rgb(0_0_0/0.35)]"
            >
              {sello && <div className="px-3 py-2">{sello}</div>}
              {items}
            </nav>
          </details>
        </div>
      </div>
      <div aria-hidden className="hazard h-1.5" />
    </header>
  );
}
