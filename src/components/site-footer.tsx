import Link from 'next/link';

import { HORARIOS } from '@/components/horarios';
import { Logo } from '@/components/icons';
import { hasShell, site } from '@/lib/site';

const col = 'font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent';
const a = 'text-zinc-300 transition-colors hover:text-white hover:underline';

// El pie de todas las rutas (lo renderiza layout.tsx): marca, horarios y accesos.
export function SiteFooter() {
  if (!hasShell()) return null;
  return (
    <footer className="bg-brand text-sm text-zinc-300">
      <div aria-hidden className="hazard h-1.5" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs leading-6">
            Taller de motos de 125 a 1300 cc. Reservás tu hora, seguís tu orden desde el celular y retirás tu moto lista.
          </p>
        </div>
        <div>
          <h2 className={col}>Horarios</h2>
          <ul className="mt-4 grid gap-2">
            {HORARIOS.map((h) => (
              <li className="flex items-baseline justify-between gap-4 border-b border-white/15 pb-2" key={h.dia}>
                <span className="font-display uppercase tracking-wide text-white">{h.dia}</span>
                <span className="tabular-nums">{h.abierto ? `${h.desde} a ${h.hasta} hs` : 'Cerrado'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={col}>Accesos</h2>
          <ul className="mt-4 grid gap-2">
            <li>
              <Link className={a} href="/servicios">
                Servicios y precios
              </Link>
            </li>
            <li>
              <Link className={a} href="/reservar">
                Reservar hora
              </Link>
            </li>
            {site.accounts && (
              <>
                <li>
                  <Link className={a} href="/login">
                    Ingresar
                  </Link>
                </li>
                <li>
                  <Link className={a} href="/register">
                    Crear cuenta
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-zinc-400 sm:px-6">
          © {new Date().getFullYear()} Ride Service. Hecho por y para motociclistas.
        </p>
      </div>
    </footer>
  );
}
