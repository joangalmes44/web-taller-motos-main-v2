'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { asignarMecanico, cambiarEstado, responderAdicional, vencerAdicionales } from '../actions';

import { button, input } from '@/components/ui';
import { restante } from '@/lib/ordenes';
import { uuid } from '@/lib/uuid';

type R = { ok: boolean; error?: string };

function useAccion() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const correr = (f: () => Promise<R>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    void f().then((r) => {
      setBusy(false);
      if (r.ok) router.refresh();
      else {
        setMsg(r.error ?? 'No se pudo.');
        router.refresh();
      }
    });
  };
  return { msg, busy, correr };
}

const Aviso = ({ msg }: { msg: string | null }) => (msg ? <p className="rounded-sm border-2 border-signal bg-signal/10 p-3 text-sm font-medium text-brand" role="alert">{msg}</p> : null);

/** Recepción / Administración: asignar mecánico y cambiar el estado. */
export function ControlesStaff(p: { ordenId: string; estado: string; mecanicoId: string | null; mecanicos: { id: string; nombre: string; ocupado: boolean }[]; estados: string[]; cerrada: boolean }) {
  const { msg, busy, correr } = useAccion();
  const [mec, setMec] = useState(p.mecanicoId ?? '');
  const [est, setEst] = useState(p.estado);
  if (p.cerrada) return <p className="text-zinc-600">La orden está {p.estado.toLowerCase()}: ya no admite cambios.</p>;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm font-medium">Mecánico
          <select className={input} onChange={(e) => { setMec(e.target.value); }} value={mec}>
            <option value="">Sin asignar</option>
            {p.mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}{m.ocupado ? ' (ocupado en ese horario)' : ''}</option>)}
          </select>
        </label>
        <button className={button.secondary} disabled={busy || mec === (p.mecanicoId ?? '')} onClick={() => { correr(() => asignarMecanico(p.ordenId, mec)); }} type="button">Asignar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm font-medium">Estado
          <select className={input} onChange={(e) => { setEst(e.target.value); }} value={est}>
            {[...new Set([p.estado, ...p.estados])].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button
          className={button.primary}
          disabled={busy || est === p.estado}
          onClick={() => { if (est !== 'Anulada' || window.confirm('¿Anulás esta orden? Se libera el puesto.')) correr(() => cambiarEstado(p.ordenId, est)); }}
          type="button"
        >
          Cambiar estado
        </button>
      </div>
      <Aviso msg={msg} />
    </div>
  );
}

/** Mecánico: botones grandes para guantes. */
export function ControlesMecanico(p: { ordenId: string; estado: string; estados: readonly string[]; bloqueado: string | null }) {
  const { msg, busy, correr } = useAccion();
  return (
    <div className="grid gap-3">
      {p.bloqueado && <p className="rounded-sm border-2 border-accent bg-accent/30 p-3 font-medium">{p.bloqueado}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {p.estados.map((e) => {
          const actual = e === p.estado;
          return (
            <button
              className={`min-h-16 rounded-sm border-4 border-brand px-4 py-3 font-display text-xl font-semibold uppercase tracking-wide shadow-poster-sm disabled:opacity-50 ${actual ? 'bg-tech text-white' : 'bg-white text-brand'}`}
              disabled={busy || actual || !!p.bloqueado}
              key={e}
              onClick={() => { correr(() => cambiarEstado(p.ordenId, e)); }}
              type="button"
            >
              {actual ? `✓ ${e}` : e}
            </button>
          );
        })}
      </div>
      <Aviso msg={msg} />
    </div>
  );
}

/** Cliente: aprobar o rechazar un adicional. La misma operación se reenvía si hace doble toque. */
export function RespuestaAdicional({ id }: { id: string }) {
  const { msg, busy, correr } = useAccion();
  const [op] = useState(() => ({ aprobar: uuid(), rechazar: uuid() }));
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid grid-cols-2 gap-3">
        <button className="min-h-14 rounded-sm border-2 border-brand bg-ok px-3 py-2 font-display text-lg font-semibold uppercase tracking-wide text-white shadow-poster-sm disabled:opacity-50" disabled={busy} onClick={() => { correr(() => responderAdicional(id, 'aprobar', op.aprobar)); }} type="button">Aprobar</button>
        <button className={`${button.secondary} min-h-14 text-lg`} disabled={busy} onClick={() => { correr(() => responderAdicional(id, 'rechazar', op.rechazar)); }} type="button">Rechazar</button>
      </div>
      <Aviso msg={msg} />
    </div>
  );
}

/** Cuenta regresiva de las 24 h; al llegar a cero vence el adicional y la orden sigue. */
export function CuentaRegresiva({ venceEn }: { venceEn: string }) {
  const router = useRouter();
  const [txt, setTxt] = useState<string | null>(null);
  const avisado = useRef(false);
  useEffect(() => {
    const tick = () => {
      const t = restante(venceEn);
      setTxt(t);
      if (t === 'Vencido' && !avisado.current) {
        avisado.current = true;
        void vencerAdicionales().then(() => { router.refresh(); });
      }
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => { clearInterval(i); };
  }, [venceEn, router]);
  return <span className="font-display text-xl tabular-nums">{txt ?? '…'}</span>;
}

/** Si al abrir la pantalla hay adicionales ya vencidos, los cierra una vez. */
export function VencerAlAbrir() {
  const router = useRouter();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    void vencerAdicionales().then(() => { router.refresh(); });
  }, [router]);
  return null;
}
