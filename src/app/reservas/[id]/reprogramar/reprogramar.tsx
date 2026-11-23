'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { reprogramarReserva } from '../../../reservar/actions';
import { SelectorBloques } from '../../../reservar/selector-bloques';

import { Card, button } from '@/components/ui';
import { cuando } from '@/lib/agenda';
import { uuid } from '@/lib/uuid';

export function Reprogramar(p: { id: string; cc: number; servicioId: string; hoy: string; volver: string }) {
  const router = useRouter();
  const [inicio, setInicio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const op = useRef(uuid());
  return (
    <div className="grid gap-4">
      {error && <p className="rounded-sm border-2 border-signal bg-white p-3 text-sm font-medium text-signal" role="alert">{error}</p>}
      <Card title="Nuevo bloque">
        <SelectorBloques cc={p.cc} excluir={p.id} hoy={p.hoy} onPick={setInicio} servicioId={p.servicioId} value={inicio} version={version} />
      </Card>
      <div className="flex flex-wrap gap-3">
        <button
          className={button.primary}
          disabled={!inicio || busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void reprogramarReserva(p.id, inicio, op.current).then((r) => {
              setBusy(false);
              if (r.ok) { router.push(`/reservas/${r.id ?? ''}`); return; }
              setError(r.error);
              if (r.refrescar) { setInicio(''); setVersion((v) => v + 1); }
            });
          }}
          type="button"
        >
          {busy ? 'Moviendo…' : inicio ? `Mover a ${cuando(inicio)}` : 'Elegí un bloque'}
        </button>
        <button className={button.secondary} onClick={() => { router.push(p.volver); }} type="button">Dejar como está</button>
      </div>
    </div>
  );
}
