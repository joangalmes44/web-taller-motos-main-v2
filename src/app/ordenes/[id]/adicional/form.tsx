'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { proponerAdicional } from '../../actions';

import { button, input } from '@/components/ui';
import { uuid } from '@/lib/uuid';

type Rep = { id: string; sku: string; nombre: string; precio: number; especial: boolean };
const grande = 'min-h-14 rounded-sm border-4 border-brand bg-white px-5 font-display text-2xl font-semibold shadow-poster-sm disabled:opacity-40';

export function FormAdicional({ ordenId, catalogo }: { ordenId: string; catalogo: Rep[] }) {
  const router = useRouter();
  const [op] = useState(() => uuid());
  const [desc, setDesc] = useState('');
  const [mano, setMano] = useState('');
  const [extra, setExtra] = useState(0);
  const [lista, setLista] = useState<{ id: string; cantidad: number }[]>([]);
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const visibles = catalogo.filter((r) => `${r.sku} ${r.nombre}`.toLowerCase().includes(filtro.toLowerCase())).slice(0, 40);
  const hayEspecial = lista.some((l) => catalogo.find((c) => c.id === l.id)?.especial);

  const agregar = () => {
    if (!sel) return;
    setLista((l) => (l.some((x) => x.id === sel) ? l.map((x) => (x.id === sel ? { ...x, cantidad: x.cantidad + 1 } : x)) : [...l, { id: sel, cantidad: 1 }]));
  };
  const enviar = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void proponerAdicional({ operationId: op, ordenId, descripcion: desc, manoObraClp: Number(mano || 0), tiempoExtraMin: extra, repuestos: lista }).then((r) => {
      setBusy(false);
      if (r.ok) router.push(`/ordenes/${ordenId}`);
      else setError(r.error);
    });
  };

  return (
    <div className="grid gap-6">
      <label className="text-base font-medium">¿Qué encontraste?
        <textarea className={`${input} text-lg`} maxLength={600} onChange={(e) => { setDesc(e.target.value); }} placeholder="Ej.: retenes de horquilla gastados, pierden aceite" rows={3} value={desc} />
      </label>
      <label className="text-base font-medium">Mano de obra ($ CLP)
        <input className={`${input} text-2xl`} inputMode="numeric" min={0} onChange={(e) => { setMano(e.target.value); }} type="number" value={mano} />
      </label>
      <div>
        <p className="text-base font-medium">Tiempo extra estimado</p>
        <div className="mt-2 flex items-center gap-4">
          <button aria-label="Menos tiempo" className={grande} disabled={extra <= 0} onClick={() => { setExtra((e) => Math.max(0, e - 30)); }} type="button">−</button>
          <span className="min-w-28 text-center font-display text-4xl tabular-nums">{extra === 0 ? 'Sin extra' : `${(extra / 60).toString().replace('.', ',')} h`}</span>
          <button aria-label="Más tiempo" className={grande} disabled={extra >= 600} onClick={() => { setExtra((e) => e + 30); }} type="button">+</button>
        </div>
      </div>
      <div className="grid gap-3">
        <p className="text-base font-medium">Repuestos del catálogo</p>
        <input aria-label="Buscar repuesto" className={`${input} mt-0`} onChange={(e) => { setFiltro(e.target.value); }} placeholder="Buscar por nombre o SKU" value={filtro} />
        <select aria-label="Repuesto" className={`${input} mt-0 text-lg`} onChange={(e) => { setSel(e.target.value); }} size={5} value={sel}>
          {visibles.map((r) => <option key={r.id} value={r.id}>{r.sku} · {r.nombre}{r.especial ? ' · ESPECIAL' : ''}</option>)}
        </select>
        <button className={`${button.secondary} min-h-14 text-lg`} disabled={!sel} onClick={agregar} type="button">Agregar repuesto</button>
        {lista.length > 0 && (
          <ul className="grid gap-2">
            {lista.map((l) => {
              const r = catalogo.find((c) => c.id === l.id);
              return (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-zinc-300 p-3" key={l.id}>
                  <span className="min-w-0 flex-1 font-medium">{r?.nombre}{r?.especial ? ' (especial)' : ''}</span>
                  <span className="flex items-center gap-2">
                    <button aria-label="Menos" className={`${grande} min-h-12 px-4`} onClick={() => { setLista((x) => x.flatMap((y) => (y.id !== l.id ? [y] : y.cantidad > 1 ? [{ ...y, cantidad: y.cantidad - 1 }] : []))); }} type="button">−</button>
                    <span className="min-w-8 text-center font-display text-2xl">{l.cantidad}</span>
                    <button aria-label="Más" className={`${grande} min-h-12 px-4`} onClick={() => { setLista((x) => x.map((y) => (y.id === l.id ? { ...y, cantidad: Math.min(50, y.cantidad + 1) } : y))); }} type="button">+</button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {hayEspecial && <p className="rounded-sm border-2 border-accent bg-accent/30 p-3 text-sm font-medium">Hay un repuesto especial: cuando el cliente apruebe, el taller le va a pedir un abono del 50 % antes de encargarlo.</p>}
      </div>
      {error && <p className="rounded-sm border-2 border-signal bg-signal/10 p-3 font-medium" role="alert">{error}</p>}
      <button className={`${button.primary} min-h-16 text-xl`} disabled={busy} onClick={enviar} type="button">{busy ? 'Enviando…' : 'Enviar al cliente para aprobación'}</button>
    </div>
  );
}
