'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { text } from './text';

import { Badge } from '@/components/ui';
import type { Rol } from '@/db/schema';
import { sessionKept, signIn } from '@/lib/auth-client';
import { captchaHeaders, getChallenge, type Challenge } from '@/lib/captcha-client';

type Cuenta = { rol: Rol; rolNombre: string; nombre: string; email: string; detalle: string };

const TONO: Record<Rol, 'blue' | 'amber' | 'green' | 'red'> = {
  cliente: 'green',
  mecanico: 'blue',
  recepcion: 'amber',
  administracion: 'red',
};

/** «Accesos demo»: una tarjeta por cuenta de prueba; ingresa con su correo y la contraseña demo y va a /panel. */
export function DemoAccesos({ cuentas, password }: { cuentas: Cuenta[]; password: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function entrar(email: string) {
    setError(null);
    setCargando(email);
    try {
      const send = async (c: Challenge | null) =>
        signIn.email({
          email,
          password,
          fetchOptions: c ? { headers: await captchaHeaders(c, '') } : undefined,
        });
      const c = await getChallenge();
      let { error: fallo } = await send(c);
      // el visitante parece inusual: la respuesta trae un desafío de prueba de trabajo
      if (fallo?.code === 'CHALLENGE_REQUIRED' && c) {
        const harder = fallo as unknown as Omit<Challenge, 'at'>;
        ({ error: fallo } = await send({ challenge: harder.challenge, difficulty: harder.difficulty, at: 0 }));
      }
      if (fallo) {
        setError(fallo.message ?? text.failed);
        return;
      }
      if (!(await sessionKept())) {
        setError(text.framedBlocked);
        return;
      }
      router.replace('/panel');
      router.refresh();
    } catch {
      setError(text.failed);
    } finally {
      setCargando(null);
    }
  }

  return (
    <section aria-labelledby="demo-titulo" className="mt-10 border-2 border-dashed border-brand bg-cream p-5">
      <h2 className="font-display text-2xl font-semibold uppercase tracking-wide" id="demo-titulo">
        {text.demo.title}
      </h2>
      <p className="mt-1 text-sm text-zinc-700">{text.demo.lead}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {cuentas.map((c) => (
          <li className="flex min-w-0 flex-col border-2 border-brand bg-white p-3" key={c.email}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={TONO[c.rol]}>{c.rolNombre}</Badge>
            </div>
            <p className="mt-2 font-display text-lg font-semibold uppercase leading-tight tracking-wide">{c.nombre}</p>
            <p className="mt-1 flex-1 text-sm text-zinc-600">{c.detalle}</p>
            <p className="mt-2 break-all text-xs text-zinc-600">{c.email}</p>
            <button
              className="mt-3 rounded-sm border-2 border-brand bg-brand px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-white shadow-[3px_3px_0_0_var(--color-accent)] transition-all hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tech disabled:pointer-events-none disabled:opacity-50"
              disabled={cargando !== null}
              onClick={() => void entrar(c.email)}
              type="button"
            >
              {cargando === c.email ? text.demo.entering : `${text.demo.enter} ${c.rolNombre.toLowerCase()}`}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-4 border-2 border-signal bg-white px-3 py-2 text-sm font-medium text-signal" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
