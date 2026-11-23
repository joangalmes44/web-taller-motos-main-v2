'use client';

import { useCallback, useEffect, useState } from 'react';

import { button, input } from '@/components/ui';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha + grilla de bloques libres que devuelve la agenda pública. `onPick` recibe "AAAA-MM-DDTHH:mm". */
export function SelectorBloques(props: {
  servicioId: string;
  cc: number;
  hoy: string;
  excluir?: string;
  value: string;
  onPick: (inicio: string) => void;
  /** Cambia cuando otra parte pide refrescar */
  version?: number;
}) {
  const { servicioId, cc, hoy, excluir, onPick, version } = props;
  const [fecha, setFecha] = useState(props.value.slice(0, 10) || '');
  const [bloques, setBloques] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!fecha) return;
    setCargando(true);
    setError(null);
    try {
      const q = new URLSearchParams({ servicio: servicioId, cc: String(cc), fecha });
      if (excluir) q.set('excluir', excluir);
      const r = await fetch(`/api/disponibilidad?${q.toString()}`);
      const j = (await r.json()) as { bloques?: string[]; error?: string; aviso?: string };
      if (!r.ok) setError(j.error ?? 'No pudimos traer los horarios. Probá de nuevo.');
      else {
        setBloques(j.bloques ?? []);
        if (j.aviso) setError(j.aviso);
      }
    } catch {
      setError('No pudimos traer los horarios. Revisá tu conexión y probá de nuevo.');
    }
    setCargando(false);
  }, [fecha, servicioId, cc, excluir]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  const dia = fecha ? DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()] : '';
  return (
    <div>
      <label className="block font-display text-sm font-medium uppercase tracking-wide" htmlFor="fecha">Elegí el día</label>
      <input className={input} id="fecha" min={hoy} onChange={(e) => { setFecha(e.target.value); setBloques(null); }} type="date" value={fecha} />
      {!fecha && <p className="mt-3 text-sm text-zinc-600">Elegí un día para ver los bloques libres.</p>}
      {cargando && <p className="mt-3 text-sm text-zinc-600">Buscando bloques libres…</p>}
      {error && <p className="mt-3 text-sm font-medium text-signal" role="alert">{error}</p>}
      {bloques && !cargando && fecha && (
        bloques.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-700" role="status">
            {dia === 'domingo' ? 'Los domingos el taller está cerrado. Probá de lunes a sábado.' : `No quedan bloques libres el ${dia} para este servicio. Probá otro día.`}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600">Solo ves bloques donde entra el trabajo completo antes del cierre.</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {bloques.map((h) => {
                const sel = props.value === `${fecha}T${h}`;
                return (
                  <button aria-pressed={sel} className={`rounded-sm border-2 px-2 py-3 font-display text-xl font-semibold tabular-nums transition-colors ${sel ? 'border-brand bg-brand text-white' : 'border-zinc-300 bg-white hover:border-brand'}`} key={h} onClick={() => { onPick(`${fecha}T${h}`); }} type="button">
                    {h}
                  </button>
                );
              })}
            </div>
          </>
        )
      )}
      <button className={`${button.secondary} mt-4`} onClick={() => { void cargar(); }} type="button">Refrescar horarios</button>
    </div>
  );
}
