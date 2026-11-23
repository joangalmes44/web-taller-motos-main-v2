'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { recibirCompra } from './actions';

import { button, input } from '@/components/ui';
import { uuid } from '@/lib/uuid';

export function Recibir({ compraId, items }: { compraId: string; items: { id: string; nombre: string; falta: number }[] }) {
  const router = useRouter();
  const op = useRef(uuid());
  const [q, setQ] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enviar = () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const cantidades = Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Number(v) || 0]));
    void recibirCompra({ compraId, operationId: op.current, cantidades }).then((r) => {
      setBusy(false);
      if (r.ok) {
        op.current = uuid();
        setQ({});
        router.refresh();
      } else setErr(r.error);
    });
  };
  return (
    <div className="mt-4 grid gap-3">
      {items.filter((i) => i.falta > 0).map((i) => (
        <label key={i.id} className="flex items-center justify-between gap-3 text-sm font-medium">
          <span className="min-w-0">{i.nombre} <span className="font-normal text-zinc-600">(faltan {i.falta})</span></span>
          <input type="number" inputMode="numeric" min={0} max={i.falta} className={`${input} !mt-0 w-24`} value={q[i.id] ?? ''} onChange={(e) => setQ({ ...q, [i.id]: e.target.value })} placeholder="0" />
        </label>
      ))}
      <div>
        <button type="button" className={button.primary} disabled={busy} onClick={enviar}>{busy ? 'Guardando…' : 'Registrar recepción'}</button>
      </div>
      {err && <p role="alert" className="text-sm font-medium text-signal">{err}</p>}
    </div>
  );
}
