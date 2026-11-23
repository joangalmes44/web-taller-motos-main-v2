'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { actualizarKm, cancelarReserva } from '../reservar/actions';

import { button, input } from '@/components/ui';

export function CancelarBoton({ id }: { id: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className={button.secondary}
        disabled={busy}
        onClick={() => {
          if (!window.confirm('¿Cancelás esta reserva? Se libera el bloque y no tiene costo.')) return;
          setBusy(true);
          void cancelarReserva(id).then((r) => { setBusy(false); if (r.ok) router.refresh(); else setMsg(r.error); });
        }}
        type="button"
      >
        Cancelar
      </button>
      {msg && <p className="mt-2 text-sm font-medium text-signal" role="alert">{msg}</p>}
    </div>
  );
}

export function KmForm({ motoId, actual }: { motoId: string; actual: number }) {
  const router = useRouter();
  const [km, setKm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void actualizarKm(motoId, Number(km)).then((r) => {
          if (r.ok) { setKm(''); setMsg({ ok: true, t: 'Kilometraje actualizado.' }); router.refresh(); } else setMsg({ ok: false, t: r.error });
        });
      }}
    >
      <label className="text-sm font-medium">
        Kilometraje actual
        <input className={`${input} w-40`} inputMode="numeric" onChange={(e) => { setKm(e.target.value.replace(/\D/g, '')); }} placeholder={String(actual)} value={km} />
      </label>
      <button className={button.secondary} disabled={!km} type="submit">Guardar</button>
      {msg && <p className={`w-full text-sm font-medium ${msg.ok ? 'text-ok' : 'text-signal'}`} role={msg.ok ? 'status' : 'alert'}>{msg.t}</p>}
    </form>
  );
}
