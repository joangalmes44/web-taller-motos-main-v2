'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { crearReserva } from './actions';
import { SelectorBloques } from './selector-bloques';

import { Badge, Card, button, input } from '@/components/ui';
import { cuando } from '@/lib/agenda';
import { uuid } from '@/lib/uuid';
import { CC_MAX, CC_MIN, clp, horas, rangoDe, RANGO_TEXTO } from '@/lib/catalogo';

type Props = {
  hoy: string;
  logueado: boolean;
  penalidad: number;
  motos: { id: string; patente: string; marca: string; modelo: string; cc: number }[];
  servicios: { id: string; nombre: string; nota: string | null }[];
  tarifas: { servicioId: string; rango: string; duracionMin: number; precioClp: number }[];
};
type Estado = { motoId: string; cc: string; patente: string; marca: string; modelo: string; km: string; servicio: string; inicio: string };
const VACIO: Estado = { motoId: '', cc: '', patente: '', marca: '', modelo: '', km: '', servicio: '', inicio: '' };
const CLAVE = 'rs-reserva';

const label = 'block font-display text-sm font-medium uppercase tracking-wide';

export function ReservaWizard(p: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [e, setE] = useState<Estado>(p.motos.length === 1 ? { ...VACIO, motoId: p.motos[0]?.id ?? '' } : VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [version, setVersion] = useState(0);
  const operacion = useRef('');
  const listo = useRef(false);

  useEffect(() => {
    operacion.current = uuid();
    try {
      const g = sessionStorage.getItem(CLAVE);
      if (g) {
        const j = JSON.parse(g) as { e: Estado; paso: number };
        setE(j.e);
        setPaso(j.paso);
      }
    } catch { /* sin datos guardados */ }
    listo.current = true;
  }, []);
  useEffect(() => {
    if (listo.current) sessionStorage.setItem(CLAVE, JSON.stringify({ e, paso }));
  }, [e, paso]);

  const motoSel = p.motos.find((m) => m.id === e.motoId);
  const cc = motoSel ? motoSel.cc : Number(e.cc);
  const rango = e.motoId || e.cc ? rangoDe(cc) : null;
  const tarifa = rango && e.servicio ? p.tarifas.find((t) => t.servicioId === e.servicio && t.rango === rango) : null;
  const servicio = p.servicios.find((s) => s.id === e.servicio);
  const nuevaMoto = !e.motoId;
  const motoOk = e.motoId || (rango && e.patente.trim().length >= 5 && e.marca.trim() && e.modelo.trim());
  const paso1Ok = !!(motoOk && tarifa);
  const set = (k: keyof Estado, v: string) => { setE((s) => ({ ...s, [k]: v, ...(k === 'servicio' || k === 'cc' || k === 'motoId' ? { inicio: '' } : {}) })); };

  async function confirmar() {
    setEnviando(true);
    setError(null);
    const r = await crearReserva({
      operationId: operacion.current, servicioId: e.servicio, inicio: e.inicio,
      ...(e.motoId ? { motoId: e.motoId } : { moto: { patente: e.patente, marca: e.marca, modelo: e.modelo, cc: Number(e.cc), km: Number(e.km) || 0 } }),
    });
    if (r.ok) {
      sessionStorage.removeItem(CLAVE);
      router.push(`/reservas/${r.id ?? ''}`);
      return;
    }
    setEnviando(false);
    setError(r.error);
    if (r.refrescar) {
      setE((s) => ({ ...s, inicio: '' }));
      setVersion((v) => v + 1);
      setPaso(2);
    }
  }

  const resumen = (
    <Card title="Tu reserva">
      {tarifa ? (
        <p className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-3xl">
          {horas(tarifa.duracionMin)} de trabajo · {clp(tarifa.precioClp)} de mano de obra
        </p>
      ) : (
        <p className="text-zinc-600">Cargá la cilindrada y elegí un servicio para ver cuánto dura y cuánto sale.</p>
      )}
      {e.inicio && <p className="mt-2 font-medium">{cuando(e.inicio)}</p>}
    </Card>
  );

  return (
    <div className="grid gap-4">
      <ol className="flex gap-2 font-display text-sm font-semibold uppercase tracking-wide">
        {['Moto y servicio', 'Día y hora', 'Confirmar'].map((t, i) => (
          <li className={`flex-1 border-b-4 pb-1 ${paso === i + 1 ? 'border-signal text-brand' : paso > i + 1 ? 'border-ok text-zinc-600' : 'border-zinc-300 text-zinc-500'}`} key={t}>{i + 1}. {t}</li>
        ))}
      </ol>
      {error && <p className="rounded-sm border-2 border-signal bg-white p-3 text-sm font-medium text-signal" role="alert">{error}</p>}

      {paso === 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Tu moto">
            {p.motos.length > 0 && (
              <div className="mb-4 grid gap-2">
                {p.motos.map((m) => (
                  <label className={`flex cursor-pointer items-center gap-3 rounded-sm border-2 p-3 ${e.motoId === m.id ? 'border-brand bg-accent/30' : 'border-zinc-300'}`} key={m.id}>
                    <input checked={e.motoId === m.id} className="size-4 accent-brand" name="moto" onChange={() => { set('motoId', m.id); }} type="radio" />
                    <span><span className="font-medium">{m.marca} {m.modelo}</span> <span className="text-sm text-zinc-600">· {m.patente} · {m.cc} cc</span></span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-sm border-2 p-3 ${nuevaMoto ? 'border-brand bg-accent/30' : 'border-zinc-300'}`}>
                  <input checked={nuevaMoto} className="size-4 accent-brand" name="moto" onChange={() => { set('motoId', ''); }} type="radio" />
                  <span className="font-medium">Cargar otra moto</span>
                </label>
              </div>
            )}
            {nuevaMoto && (
              <div className="grid gap-3">
                <div>
                  <label className={label} htmlFor="cc">Cilindrada (cc)</label>
                  <input className={input} id="cc" inputMode="numeric" onChange={(ev) => { set('cc', ev.target.value.replace(/\D/g, '')); }} placeholder="Ej.: 650" value={e.cc} />
                  {e.cc !== '' && !rango && <p className="mt-2 text-sm font-medium text-signal" role="alert">Atendemos motos de {CC_MIN} a {CC_MAX} cc. Revisá la cilindrada que cargaste.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label} htmlFor="marca">Marca</label><input className={input} id="marca" onChange={(ev) => { set('marca', ev.target.value); }} placeholder="Ej.: Honda" value={e.marca} /></div>
                  <div><label className={label} htmlFor="modelo">Modelo</label><input className={input} id="modelo" onChange={(ev) => { set('modelo', ev.target.value); }} placeholder="Ej.: CB 650" value={e.modelo} /></div>
                  <div><label className={label} htmlFor="patente">Patente</label><input className={`${input} uppercase`} id="patente" maxLength={8} onChange={(ev) => { set('patente', ev.target.value); }} placeholder="Ej.: KLTV45" value={e.patente} /></div>
                  <div><label className={label} htmlFor="km">Kilometraje</label><input className={input} id="km" inputMode="numeric" onChange={(ev) => { set('km', ev.target.value.replace(/\D/g, '')); }} placeholder="Ej.: 12000" value={e.km} /></div>
                </div>
              </div>
            )}
            {rango && <p className="mt-3 text-sm font-medium text-zinc-700">Tu moto entra en el rango {rango} ({RANGO_TEXTO[rango]}).</p>}
          </Card>
          <Card title="Elegí tu servicio">
            <div className="grid gap-2">
              {p.servicios.map((s) => (
                <label className={`flex cursor-pointer items-start gap-3 rounded-sm border-2 p-3 transition-colors ${e.servicio === s.id ? 'border-brand bg-accent/30 shadow-poster-sm' : 'border-zinc-300 hover:border-brand'}`} key={s.id}>
                  <input checked={e.servicio === s.id} className="mt-1 size-4 accent-brand" name="servicio" onChange={() => { set('servicio', s.id); }} type="radio" />
                  <span>
                    <span className="font-display text-lg font-medium uppercase tracking-wide">{s.nombre}</span>
                    {s.nota && <span className="block text-xs text-zinc-600">{s.nota}</span>}
                  </span>
                </label>
              ))}
            </div>
          </Card>
          <div className="md:col-span-2">{resumen}</div>
          <div className="md:col-span-2">
            <button className={button.primary} disabled={!paso1Ok} onClick={() => { setError(null); setPaso(2); }} type="button">Elegir día y hora</button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <>
          {resumen}
          <Card title={servicio ? `Bloques libres para ${servicio.nombre}` : 'Bloques libres'}>
            <SelectorBloques cc={cc} hoy={p.hoy} onPick={(i) => { setE((s) => ({ ...s, inicio: i })); setError(null); }} servicioId={e.servicio} value={e.inicio} version={version} />
          </Card>
          <div className="flex flex-wrap gap-3">
            <button className={button.secondary} onClick={() => { setPaso(1); }} type="button">Volver</button>
            <button className={button.primary} disabled={!e.inicio} onClick={() => { setError(null); setPaso(3); }} type="button">Seguir</button>
          </div>
        </>
      )}

      {paso === 3 && (
        <>
          {resumen}
          <Card title="Confirmá tu reserva">
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="text-zinc-600">Servicio</dt><dd className="font-medium">{servicio?.nombre}</dd></div>
              <div><dt className="text-zinc-600">Moto</dt><dd className="font-medium">{motoSel ? `${motoSel.marca} ${motoSel.modelo} · ${motoSel.patente}` : `${e.marca} ${e.modelo} · ${e.patente.toUpperCase()}`} ({String(cc)} cc)</dd></div>
              <div><dt className="text-zinc-600">Cuándo</dt><dd className="font-medium">{e.inicio && cuando(e.inicio)}</dd></div>
            </dl>
            {p.logueado && p.penalidad > 0 && (
              <div className="mt-4 rounded-sm border-2 border-accent bg-accent/30 p-3 text-sm">
                <Badge tone="amber">Abono previo</Badge>
                <p className="mt-2">Tenés 3 ausencias en los últimos 6 meses, así que para confirmar esta hora necesitamos un abono de <strong>{clp(p.penalidad)}</strong>. Queda <strong>Pendiente</strong> y guardamos el bloque; Recepción la confirma cuando registre el abono en el taller.</p>
              </div>
            )}
            <div className="mt-5">
              {p.logueado ? (
                <button className={button.primary} disabled={enviando} onClick={() => { void confirmar(); }} type="button">{enviando ? 'Reservando…' : 'Confirmar reserva'}</button>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-zinc-700">Para confirmar necesitamos que ingreses o crees tu cuenta. Guardamos lo que elegiste y volvés acá.</p>
                  <div className="flex flex-wrap gap-3">
                    <Link className={button.primary} href="/login?next=/reservar">Ya tengo cuenta</Link>
                    <Link className={button.secondary} href="/register?next=/reservar">Crear mi cuenta</Link>
                  </div>
                </div>
              )}
            </div>
          </Card>
          <div><button className={button.secondary} onClick={() => { setPaso(2); }} type="button">Volver</button></div>
        </>
      )}
    </div>
  );
}
