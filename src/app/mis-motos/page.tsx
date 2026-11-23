import { and, desc, eq, inArray, notInArray } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CancelarBoton, KmForm } from './acciones';

import { AutoRefresh } from '@/components/auto-refresh';
import { AppPage, Badge, Card, EmptyState, button } from '@/components/ui';
import { db } from '@/db';
import { motoKm, motos, puestos, reservas, servicios } from '@/db/schema';
import { ORDEN_TONO } from '@/lib/ordenes';
import { ahoraCL, CANCELAR_HORAS, cuando, diffMin, ESTADO_TONO } from '@/lib/agenda';
import { ordenes } from '@/db/schema';
import { loadPage } from '@/lib/load-page';

export const metadata: Metadata = { title: 'Mis motos y reservas' };

export default async function MisMotosPage() {
  const { user, data } = await loadPage(
    (me) => [
      db.select().from(motos).where(eq(motos.userId, me)).orderBy(desc(motos.creadoEn)).limit(30),
      db
        .select({ id: reservas.id, inicio: reservas.inicio, estado: reservas.estado, motoId: reservas.motoId, servicio: servicios.nombre, puesto: puestos.numero, abono: reservas.abonoRequeridoClp })
        .from(reservas)
        .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
        .innerJoin(puestos, eq(puestos.id, reservas.puestoId))
        .where(eq(reservas.userId, me))
        .orderBy(desc(reservas.inicio))
        .limit(40),
      db
        .select({ motoId: motoKm.motoId, km: motoKm.km, fuente: motoKm.fuente, creadoEn: motoKm.creadoEn })
        .from(motoKm)
        .innerJoin(motos, eq(motos.id, motoKm.motoId))
        .where(eq(motos.userId, me))
        .orderBy(desc(motoKm.creadoEn))
        .limit(60),
      db.select({ id: ordenes.id, motoId: ordenes.motoId, estado: ordenes.estado, entrega: ordenes.entregaEstimada }).from(ordenes).where(and(eq(ordenes.userId, me), notInArray(ordenes.estado, ['Entregada', 'Anulada']))).orderBy(desc(ordenes.creadoEn)).limit(10),
    ] as const,
    { signedIn: true },
  );
  if (!user || !data) redirect('/login?next=/mis-motos');
  const [mis, res, kms, abiertas] = data;
  const ahora = ahoraCL();
  const proximas = res.filter((r) => ['Pendiente', 'Confirmada', 'En taller'].includes(r.estado) && r.inicio >= ahora.slice(0, 10)).reverse();
  const pasadas = res.filter((r) => !proximas.includes(r)).slice(0, 8);
  const nombreMoto = (id: string) => { const m = mis.find((x) => x.id === id); return m ? `${m.marca} ${m.modelo}` : 'Moto'; };
  const enTaller = abiertas;
  return (
    <AppPage action={<Link className={button.primary} href="/reservar">Reservar hora</Link>} description="Tus motos, su kilometraje y tus próximas horas." title="Mis motos y reservas">
      <AutoRefresh />
      {enTaller.length > 0 && (
        <Card title="En el taller ahora">
          {enTaller.map((r) => (
            <p className="flex flex-wrap items-center gap-2" key={r.id}><Badge tone={ORDEN_TONO[r.estado as keyof typeof ORDEN_TONO] ?? 'blue'}>{r.estado}</Badge> <span className="font-medium">{nombreMoto(r.motoId)}</span> · Entrega {cuando(r.entrega)} <Link className="underline" href={`/ordenes/${r.id}`}>Seguir mi orden</Link></p>
          ))}
        </Card>
      )}
      <Card title="Próximas reservas">
        {proximas.length === 0 ? (
          <EmptyState action={<Link className={button.primary} href="/reservar">Reservar hora</Link>} text="Cuando reserves, la ves acá y la podés cancelar o mover." title="No tenés reservas próximas" />
        ) : (
          <ul className="divide-y-2 divide-zinc-200">
            {proximas.map((r) => {
              const libre = diffMin(ahora, r.inicio) / 60 > CANCELAR_HORAS;
              const mod = ['Pendiente', 'Confirmada'].includes(r.estado);
              return (
                <li className="grid gap-2 py-4 first:pt-0 last:pb-0" key={r.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ESTADO_TONO[r.estado as keyof typeof ESTADO_TONO] ?? 'gray'}>{r.estado}</Badge>
                    <span className="font-display text-xl font-semibold uppercase tracking-wide">{cuando(r.inicio)}</span>
                  </div>
                  <p className="text-sm text-zinc-700">{r.servicio} · {nombreMoto(r.motoId)} · Puesto {r.puesto}</p>
                  {r.estado === 'Pendiente' && <p className="text-sm font-medium">Falta el abono previo de ${r.abono.toLocaleString('es-CL')}: pagalo en el taller para confirmar.</p>}
                  <div className="flex flex-wrap items-start gap-2">
                    <Link className={button.secondary} href={`/reservas/${r.id}`}>Ver detalle</Link>
                    {mod && libre && <Link className={button.secondary} href={`/reservas/${r.id}/reprogramar`}>Reprogramar</Link>}
                    {mod && libre && <CancelarBoton id={r.id} />}
                  </div>
                  {mod && !libre && <p className="text-sm text-zinc-600">Faltan menos de {CANCELAR_HORAS} horas: para cambiarla escribinos por WhatsApp o pasá por el taller.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {mis.length === 0 && <Card title="Mis motos"><EmptyState text="Se cargan solas al hacer tu primera reserva." title="Todavía no cargaste ninguna moto" /></Card>}
        {mis.map((m) => (
          <Card key={m.id} title={`${m.marca} ${m.modelo}`}>
            <p className="text-sm text-zinc-600">Patente {m.patente} · {m.cc} cc</p>
            <p className="mt-2 font-display text-5xl font-semibold leading-none tabular-nums">{m.kmActual.toLocaleString('es-CL')} <span className="font-sans text-sm font-normal text-zinc-600">km</span></p>
            <KmForm actual={m.kmActual} motoId={m.id} />
            <h3 className="mt-4 font-display text-sm font-semibold uppercase tracking-wide">Historial de kilometraje</h3>
            <ul className="mt-1 text-sm text-zinc-700">
              {kms.filter((k) => k.motoId === m.id).slice(0, 5).map((k, i) => (
                <li key={`${k.creadoEn}${String(i)}`}>{k.creadoEn.slice(0, 10).split('-').reverse().join('/')} · {k.km.toLocaleString('es-CL')} km <span className="text-zinc-500">({k.fuente === 'alta' ? 'al cargar la moto' : k.fuente})</span></li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {pasadas.length > 0 && (
        <Card title="Reservas anteriores">
          <ul className="grid gap-2 text-sm">
            {pasadas.map((r) => (
              <li className="flex flex-wrap items-center gap-2" key={r.id}>
                <Badge tone={ESTADO_TONO[r.estado as keyof typeof ESTADO_TONO] ?? 'gray'}>{r.estado}</Badge>
                {cuando(r.inicio)} · {r.servicio}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppPage>
  );
}
