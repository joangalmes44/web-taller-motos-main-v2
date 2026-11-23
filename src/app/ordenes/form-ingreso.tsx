'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ingresoSinHora, recepcionarReserva } from './actions';

import { button, input } from '@/components/ui';
import { COMBUSTIBLE } from '@/lib/ordenes';
import { uuid } from '@/lib/uuid';

type Props = {
  reservaId?: string;
  kmMinimo?: number;
  mecanicos: { id: string; nombre: string; ocupado?: boolean }[];
  servicios?: { id: string; nombre: string }[];
};

export function FormIngreso(p: Props) {
  const router = useRouter();
  const sinHora = !p.reservaId;
  const [op] = useState(() => uuid());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = (fd: FormData) => {
    if (busy) return;
    const g = (k: string) => String(fd.get(k) ?? '');
    const base = { operationId: op, km: Number(g('km')), combustible: g('combustible'), danos: g('danos'), notas: g('notas'), mecanicoId: g('mecanicoId') };
    setBusy(true);
    setError(null);
    const f = p.reservaId
      ? recepcionarReserva({ ...base, reservaId: p.reservaId })
      : ingresoSinHora({ ...base, servicioId: g('servicioId'), nombre: g('nombre'), telefono: g('telefono'), patente: g('patente'), marca: g('marca'), modelo: g('modelo'), cc: Number(g('cc')) });
    void f.then((r) => {
      setBusy(false);
      if (r.ok) router.push(`/ordenes/${r.id ?? ''}`);
      else setError(r.error);
    });
  };

  return (
    <form action={enviar} className="grid gap-5">
      {sinHora && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 font-display text-lg uppercase">Cliente y moto</legend>
          <label className="text-sm font-medium">Patente<input autoCapitalize="characters" className={input} maxLength={10} name="patente" required /></label>
          <label className="text-sm font-medium">Servicio
            <select className={input} name="servicioId" required>
              {p.servicios?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <p className="text-sm text-zinc-600 sm:col-span-2">Si la patente ya está en el sistema, usamos la moto y el cliente que ya tiene. Si no, completá estos datos:</p>
          <label className="text-sm font-medium">Nombre del cliente<input className={input} maxLength={80} name="nombre" /></label>
          <label className="text-sm font-medium">Teléfono<input className={input} inputMode="tel" maxLength={30} name="telefono" /></label>
          <label className="text-sm font-medium">Marca<input className={input} maxLength={40} name="marca" /></label>
          <label className="text-sm font-medium">Modelo<input className={input} maxLength={40} name="modelo" /></label>
          <label className="text-sm font-medium">Cilindrada (cc)<input className={input} inputMode="numeric" max={1300} min={125} name="cc" type="number" /></label>
        </fieldset>
      )}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 font-display text-lg uppercase">Checklist de ingreso</legend>
        <label className="text-sm font-medium">Kilometraje actual<input className={input} defaultValue={p.kmMinimo ?? ''} inputMode="numeric" min={p.kmMinimo ?? 0} name="km" required type="number" /></label>
        <label className="text-sm font-medium">Nivel de combustible
          <select className={input} defaultValue="1/2" name="combustible">{COMBUSTIBLE.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Estado estético y daños previos<textarea className={input} maxLength={500} name="danos" placeholder="Ej.: rayón en el estanque, espejo izquierdo flojo" rows={3} /></label>
        <label className="text-sm font-medium sm:col-span-2">Observaciones del cliente<textarea className={input} maxLength={500} name="notas" rows={2} /></label>
        <label className="text-sm font-medium sm:col-span-2">Mecánico
          <select className={input} defaultValue="" name="mecanicoId">
            <option value="">Asignar después</option>
            {p.mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}{m.ocupado ? ' (ocupado en ese horario)' : ''}</option>)}
          </select>
        </label>
      </fieldset>
      {error && <p className="rounded-sm border-2 border-signal bg-signal/10 p-3 text-sm font-medium" role="alert">{error}</p>}
      <div><button className={button.primary} disabled={busy} type="submit">{busy ? 'Guardando…' : 'Recibir moto y abrir orden'}</button></div>
    </form>
  );
}
