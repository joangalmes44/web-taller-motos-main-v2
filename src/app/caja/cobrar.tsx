'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { cobrarOrden } from './actions';

import { button, input } from '@/components/ui';
import { MEDIOS_PAGO } from '@/lib/caja-medios';
import { uuid } from '@/lib/uuid';

export function Cobrar({ ordenId, disabled }: { ordenId: string; disabled?: boolean }) {
  const router = useRouter();
  const op = useRef(uuid());
  const [medio, setMedio] = useState<string>(MEDIOS_PAGO[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enviar = () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    void cobrarOrden({ ordenId, operationId: op.current, medio }).then((r) => {
      if (r.ok) router.push(`/recibos/${r.reciboId}`);
      else {
        setBusy(false);
        setErr(r.error);
      }
    });
  };
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">
        Medio de pago
        <select className={input} value={medio} onChange={(e) => setMedio(e.target.value)}>
          {MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <button type="button" className={button.primary} disabled={busy || disabled} onClick={enviar}>{busy ? 'Cobrando…' : 'Cobrar y entregar'}</button>
      {err && <p role="alert" className="w-full text-sm font-medium text-signal">{err}</p>}
    </div>
  );
}
