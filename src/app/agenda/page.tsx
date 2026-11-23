import { and, asc, eq, inArray, like } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AccionesAgenda } from './acciones';

import { AutoRefresh } from '@/components/auto-refresh';
import { AppPage, Badge, Card, EmptyState, button, input } from '@/components/ui';
import { db } from '@/db';
import { motos, puestos, reservas, servicios } from '@/db/schema';
import { ahoraCL, diffMin, ESTADO_TONO, fechaLarga, hhmm, horarioDe, hoyCL, sumarDias, sumarMin, TOLERANCIA_MIN } from '@/lib/agenda';
import { requireRol } from '@/lib/roles';
import { users } from '@/db/schema';

export const metadata: Metadata = { title: 'Agenda del día' };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  await requireRol(['recepcion', 'administracion']);
  const q = await searchParams;
  const fecha = q.fecha && /^\d{4}-\d{2}-\d{2}$/.test(q.fecha) && !Number.isNaN(Date.parse(q.fecha)) ? q.fecha : hoyCL();
  const [pu, rs] = await db.batch([
    db.select().from(puestos).orderBy(puestos.numero),
    db
      .select({ id: reservas.id, inicio: reservas.inicio, fin: reservas.fin, estado: reservas.estado, puestoId: reservas.puestoId, abono: reservas.abonoRequeridoClp, servicio: servicios.nombre, marca: motos.marca, modelo: motos.modelo, patente: motos.patente, cliente: users.name })
      .from(reservas)
      .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
      .innerJoin(motos, eq(motos.id, reservas.motoId))
      .innerJoin(users, eq(users.id, reservas.userId))
      .where(and(like(reservas.inicio, `${fecha}%`), inArray(reservas.estado, ['Pendiente', 'Confirmada', 'En taller', 'No asistió', 'Cancelada', 'Reprogramada'])))
      .orderBy(asc(reservas.inicio))
      .limit(100),
  ]);
  const ahora = ahoraCL();
  const h = horarioDe(fecha);
  const activas = rs.filter((r) => ['Pendiente', 'Confirmada', 'En taller'].includes(r.estado));
  const filas: string[] = [];
  if (h) for (let m = h.abre; m < h.cierra; m += 30) filas.push(`${fecha}T${hhmm(m)}`);
  const celda = (puestoId: string, ini: string) => activas.find((r) => r.puestoId === puestoId && r.inicio <= ini && r.fin > ini);
  const sinLlegar = activas.filter((r) => r.estado !== 'En taller' && diffMin(r.inicio, ahora) >= TOLERANCIA_MIN).length;
  return (
    <AppPage description={`${fechaLarga(fecha)} · ${String(activas.length)} reservas activas${sinLlegar ? ` · ${String(sinLlegar)} pasaron los 20 min de tolerancia` : ''}`} title="Agenda del día" action={<Link className={button.primary} href="/ordenes/sin-hora">Nuevo ingreso sin hora</Link>}>
      <AutoRefresh />
      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-sm font-medium">Día<input className={`${input} w-48`} defaultValue={fecha} name="fecha" type="date" /></label>
          <button className={button.secondary} type="submit">Ver día</button>
          <Link className={button.secondary} href={`/agenda?fecha=${sumarDias(fecha, -1)}`}>← Anterior</Link>
          <Link className={button.secondary} href="/agenda">Hoy</Link>
          <Link className={button.secondary} href={`/agenda?fecha=${sumarDias(fecha, 1)}`}>Siguiente →</Link>
        </form>
      </Card>
      <Card title="Ocupación de puestos">
        {!h ? (
          <EmptyState text="Los domingos el taller está cerrado." title="Sin atención este día" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-16 p-1 text-left font-display uppercase">Hora</th>
                  {pu.map((p) => <th className="p-1 text-left font-display uppercase" key={p.id}>Puesto {p.numero}{p.equipado ? ' ★' : ''}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map((ini) => (
                  <tr className="border-t border-zinc-200" key={ini}>
                    <td className="p-1 font-display text-lg tabular-nums">{ini.slice(11)}</td>
                    {pu.map((p) => {
                      const r = celda(p.id, ini);
                      const primera = r && r.inicio === ini;
                      return (
                        <td className={`p-1 align-top ${r ? (r.estado === 'En taller' ? 'bg-tech/20' : r.estado === 'Pendiente' ? 'bg-accent/50' : 'bg-ok/20') : ''}`} key={p.id}>
                          {r ? (primera ? <span className="font-medium">{r.marca} {r.modelo}<span className="block text-xs text-zinc-700">{r.servicio}</span></span> : <span className="text-zinc-500">↳</span>) : <span className="text-zinc-400">Libre</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-600">★ Puesto equipado (suspensión, geometría y diagnóstico). Verde: confirmada · Amarillo: pendiente de abono · Azul: en taller.</p>
          </div>
        )}
      </Card>
      <Card title="Reservas del día">
        {rs.length === 0 ? (
          <EmptyState text="Cuando entren reservas para este día, aparecen acá." title="No hay reservas este día" />
        ) : (
          <ul className="divide-y-2 divide-zinc-200">
            {rs.map((r) => (
              <li className="grid gap-2 py-4 first:pt-0 last:pb-0" key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-2xl font-semibold tabular-nums">{r.inicio.slice(11)}–{r.fin.slice(11)}</span>
                  <Badge tone={ESTADO_TONO[r.estado as keyof typeof ESTADO_TONO] ?? 'gray'}>{r.estado}</Badge>
                  <span className="text-sm text-zinc-600">Puesto {pu.find((p) => p.id === r.puestoId)?.numero}</span>
                </div>
                <p className="text-sm"><span className="font-medium">{r.cliente}</span> · {r.marca} {r.modelo} ({r.patente}) · {r.servicio}</p>
                {r.estado === 'Pendiente' && <p className="text-sm font-medium">Esperando abono de ${r.abono.toLocaleString('es-CL')}.</p>}
                <AccionesAgenda estado={r.estado} id={r.id} pasoTolerancia={diffMin(r.inicio, ahora) >= TOLERANCIA_MIN} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppPage>
  );
}
