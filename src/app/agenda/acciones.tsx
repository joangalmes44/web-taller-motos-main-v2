'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cancelarReserva, marcarNoAsistio, registrarAbono } from '../reservar/actions';

import { button } from '@/components/ui';

export function AccionesAgenda(p: { id: string; estado: string; pasoTolerancia: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setMsg(null);
    void f().then((r) => { setBusy(false); if (r.ok) router.refresh(); else setMsg(r.error ?? 'No se pudo.'); });
  };
  const activa = p.estado === 'Pendiente' || p.estado === 'Confirmada';
  if (!activa) return null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {p.estado === 'Confirmada' && <Link className={button.primary} href={`/ordenes/recibir/${p.id}`}>Recibir moto</Link>}
        {p.estado === 'Pendiente' && (
          <button className={button.primary} disabled={busy} onClick={() => { correr(() => registrarAbono(p.id)); }} type="button">Registrar abono</button>
        )}
        <button className={button.secondary} disabled={busy} onClick={() => { correr(() => marcarNoAsistio(p.id)); }} title={p.pasoTolerancia ? undefined : 'Disponible pasados 20 minutos de la hora'} type="button">Marcar No Asistió (+20 min)</button>
        <Link className={button.secondary} href={`/reservas/${p.id}/reprogramar`}>Reprogramar</Link>
        <button
          className={button.secondary}
          disabled={busy}
          onClick={() => { if (window.confirm('¿Cancelás esta reserva? Se libera el bloque.')) correr(() => cancelarReserva(p.id)); }}
          type="button"
        >
          Cancelar
        </button>
      </div>
      {msg && <p className="text-sm font-medium text-signal" role="alert">{msg}</p>}
    </div>
  );
}
