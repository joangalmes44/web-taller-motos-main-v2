import { and, desc, eq, like, lt, type SQL } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AutoRefresh } from '@/components/auto-refresh';
import { AppPage, Badge, Card, EmptyState, button, input } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, motos, ORDEN_ESTADOS, ordenes, puestos, servicios, users } from '@/db/schema';
import { cuando } from '@/lib/agenda';
import { numeroOrden, ORDEN_TONO } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Órdenes de trabajo' };
const PAGINA = 30;

export default async function OrdenesPage({ searchParams }: { searchParams: Promise<{ estado?: string; puesto?: string; mecanico?: string; patente?: string; antes?: string }> }) {
  const { user, rol } = await requireRol();
  if (rol === 'mecanico') redirect('/mecanico');
  const q = await searchParams;
  const staff = rol !== 'cliente';
  const patente = (q.patente ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const cond: (SQL | undefined)[] = [
    staff ? undefined : eq(ordenes.userId, user.id),
    q.estado && (ORDEN_ESTADOS as readonly string[]).includes(q.estado) ? eq(ordenes.estado, q.estado) : undefined,
    staff && q.puesto ? eq(ordenes.puestoId, q.puesto) : undefined,
    staff && q.mecanico ? eq(ordenes.mecanicoId, q.mecanico) : undefined,
    staff && patente ? like(motos.patente, `${patente}%`) : undefined,
    q.antes ? lt(ordenes.creadoEn, q.antes) : undefined,
  ];
  const [filas, pu, mec] = await db.batch([
    db
      .select({ o: ordenes, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, servicio: servicios.nombre, puesto: puestos.numero, mecanico: mecanicos.nombre, cliente: users.name })
      .from(ordenes)
      .innerJoin(motos, eq(motos.id, ordenes.motoId))
      .innerJoin(servicios, eq(servicios.id, ordenes.servicioId))
      .innerJoin(puestos, eq(puestos.id, ordenes.puestoId))
      .innerJoin(users, eq(users.id, ordenes.userId))
      .leftJoin(mecanicos, eq(mecanicos.id, ordenes.mecanicoId))
      .where(and(...cond))
      .orderBy(desc(ordenes.creadoEn))
      .limit(PAGINA + 1),
    db.select({ id: puestos.id, numero: puestos.numero }).from(puestos).orderBy(puestos.numero),
    db.select({ id: mecanicos.id, nombre: mecanicos.nombre }).from(mecanicos).orderBy(mecanicos.nombre),
  ]);
  const hayMas = filas.length > PAGINA;
  const lista = filas.slice(0, PAGINA);
  const siguiente = new URLSearchParams(Object.entries({ estado: q.estado, puesto: q.puesto, mecanico: q.mecanico, patente, antes: lista.at(-1)?.o.creadoEn }).filter((e): e is [string, string] => !!e[1]));
  return (
    <AppPage
      action={staff ? <Link className={button.primary} href="/ordenes/sin-hora">Nuevo ingreso sin hora</Link> : <Link className={button.primary} href="/reservar">Reservar hora</Link>}
      description={staff ? 'Todas las motos que pasaron por el taller, con su estado.' : 'Seguí cada moto que dejaste en el taller.'}
      title={staff ? 'Órdenes de trabajo' : 'Mis órdenes'}
    >
      <AutoRefresh />
      <Card title="Filtros">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <label className="text-sm font-medium">Estado
            <select className={input} defaultValue={q.estado ?? ''} name="estado"><option value="">Todos</option>{ORDEN_ESTADOS.map((e) => <option key={e}>{e}</option>)}</select>
          </label>
          {staff && (
            <>
              <label className="text-sm font-medium">Puesto
                <select className={input} defaultValue={q.puesto ?? ''} name="puesto"><option value="">Todos</option>{pu.map((p) => <option key={p.id} value={p.id}>Puesto {p.numero}</option>)}</select>
              </label>
              <label className="text-sm font-medium">Mecánico
                <select className={input} defaultValue={q.mecanico ?? ''} name="mecanico"><option value="">Todos</option>{mec.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              </label>
              <label className="text-sm font-medium">Patente<input className={input} defaultValue={patente} maxLength={8} name="patente" /></label>
            </>
          )}
          <div className="flex items-end gap-2"><button className={button.primary} type="submit">Filtrar</button><Link className={button.secondary} href="/ordenes">Limpiar</Link></div>
        </form>
      </Card>
      <Card title={`Órdenes (${String(lista.length)}${hayMas ? '+' : ''})`}>
        {lista.length === 0 ? (
          <EmptyState text={staff ? 'Cuando recibas una moto, la orden aparece acá. Probá sacar algún filtro.' : 'Cuando dejes tu moto en el taller, la seguís desde acá.'} title="No hay órdenes para mostrar" />
        ) : (
          <ul className="grid divide-y-2 divide-zinc-200">
            {lista.map(({ o, patente: pat, marca, modelo, servicio, puesto, mecanico, cliente }) => (
              <li key={o.id}>
                <Link className="grid gap-1 py-3 hover:bg-zinc-50 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4" href={`/ordenes/${o.id}`}>
                  <span className="min-w-0">
                    <span className="font-display text-xl uppercase">{staff ? `${numeroOrden(o.numero)} · ${pat}` : `${marca} ${modelo}`}</span>
                    <span className="block text-sm text-zinc-700">{servicio} · Puesto {puesto}{staff ? ` · ${marca} ${modelo}` : ''}</span>
                    <span className="block text-sm text-zinc-600">{staff ? `${cliente ?? ''} · ${mecanico ?? 'Sin mecánico'} · ` : ''}Entrega {cuando(o.entregaEstimada)}</span>
                  </span>
                  <Badge tone={ORDEN_TONO[o.estado as keyof typeof ORDEN_TONO] ?? 'gray'}>{o.estado}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hayMas && <div className="mt-4"><Link className={button.secondary} href={`/ordenes?${siguiente.toString()}`}>Ver órdenes anteriores</Link></div>}
      </Card>
    </AppPage>
  );
}
