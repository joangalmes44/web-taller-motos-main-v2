import { and, count, eq, gte, lt, sql } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AppPage, Badge, Card, EmptyState, Stat, button, input } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, ordenes, recibos, servicios } from '@/db/schema';
import { huboGarantia, rangoMes } from '@/lib/informe';
import { ahoraCL } from '@/lib/agenda';
import { clp } from '@/lib/catalogo';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Informes y liquidaciones' };

export default async function InformesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireRol(['administracion']);
  const { mes: q } = await searchParams;
  const hoy = String(ahoraCL(new Date())).slice(0, 7);
  const mes = q && /^20\d\d-(0[1-9]|1[0-2])$/.test(q) ? q : /^20\d\d-\d\d$/.test(hoy) ? hoy : new Date().toISOString().slice(0, 7);
  const { desde, hasta, nombre } = rangoMes(mes);

  const [resumen, liq, porEstado, porServicio, garantias] = await db.batch([
    db
      .select({ n: count(), total: sql<number>`coalesce(sum(${recibos.cobradoClp}),0)`, bodegaje: sql<number>`coalesce(sum(${recibos.bodegajeClp}),0)`, repuestos: sql<number>`coalesce(sum(${recibos.repuestosClp}),0)`, mano: sql<number>`coalesce(sum(${recibos.manoObraClp}),0)` })
      .from(recibos)
      .innerJoin(ordenes, eq(ordenes.id, recibos.ordenId))
      .where(and(gte(recibos.creadoEn, desde), lt(recibos.creadoEn, hasta), sql`${ordenes.estado} <> 'Anulada'`)),
    db
      .select({ id: mecanicos.id, nombre: mecanicos.nombre, pct: mecanicos.comisionPct, n: count(), mano: sql<number>`coalesce(sum(${recibos.manoObraClp}),0)`, nGar: sql<number>`coalesce(sum(case when ${huboGarantia} then 1 else 0 end),0)`, manoGar: sql<number>`coalesce(sum(case when ${huboGarantia} then ${recibos.manoObraClp} else 0 end),0)` })
      .from(recibos)
      .innerJoin(ordenes, eq(ordenes.id, recibos.ordenId))
      .innerJoin(mecanicos, eq(mecanicos.id, ordenes.mecanicoId))
      .where(and(gte(recibos.creadoEn, desde), lt(recibos.creadoEn, hasta), sql`${ordenes.estado} <> 'Anulada'`))
      .groupBy(mecanicos.id)
      .limit(30),
    db.select({ estado: ordenes.estado, n: count() }).from(ordenes).where(and(gte(ordenes.creadoEn, desde), lt(ordenes.creadoEn, hasta))).groupBy(ordenes.estado).limit(15),
    db
      .select({ nombre: servicios.nombre, n: count() })
      .from(ordenes)
      .innerJoin(servicios, eq(servicios.id, ordenes.servicioId))
      .where(and(gte(ordenes.creadoEn, desde), lt(ordenes.creadoEn, hasta)))
      .groupBy(servicios.id)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db.select({ n: count() }).from(ordenes).where(eq(ordenes.estado, 'Garantía')),
  ]);
  const r = resumen[0]!;
  const ticket = r.n > 0 ? Math.round(r.total / r.n) : 0;
  const filas = liq.map((l) => ({ ...l, comision: Math.round(((l.mano - l.manoGar) * l.pct) / 100) }));
  const totalCom = filas.reduce((s, f) => s + f.comision, 0);
  const max = Math.max(1, ...porServicio.map((s) => s.n));

  return (
    <AppPage title="Informes y liquidaciones" description={`Resumen de ${nombre}. Los montos salen de los recibos internos emitidos en el mes.`}>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-medium">Mes<input className={input} defaultValue={mes} name="mes" type="month" /></label>
        <button className={button.secondary} type="submit">Ver</button>
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Cobrado" value={clp(r.total)} />
        <Stat label="Recibos" value={r.n} />
        <Stat label="Ticket promedio" value={clp(ticket)} />
        <Stat label="Bodegaje cobrado" value={clp(r.bodegaje)} />
      </div>

      <Card title="Liquidación de mecánicos" action={<><Badge tone="gray">Comisión sobre mano de obra, sin órdenes con garantía</Badge> <a className="text-sm underline" href={`/informes/csv?mes=${mes}`}>Descargar CSV</a></>}>
        {filas.length === 0 ? (
          <EmptyState title="Sin trabajos cobrados" text="Cuando se cobre una orden con mecánico asignado aparece acá su comisión." />
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="border-b-2 border-brand text-left"><th className="py-2">Mecánico</th><th className="hidden sm:table-cell">Órdenes</th><th className="hidden sm:table-cell">Mano de obra</th><th className="text-right">A pagar</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr className="border-b border-zinc-200" key={f.id}>
                  <td className="py-2"><span className="font-medium">{f.nombre}</span><br /><span className="text-zinc-600">{f.pct}% · {f.n} orden(es) · {clp(f.mano)}{f.nGar > 0 ? ` · ${f.nGar} con garantía (${clp(f.manoGar)} sin comisión)` : ''}</span></td>
                  <td className="hidden sm:table-cell">{f.n}</td>
                  <td className="hidden sm:table-cell">{clp(f.mano)}</td>
                  <td className="text-right font-display text-lg">{clp(f.comision)}</td>
                </tr>
              ))}
              <tr><td className="pt-3 font-display uppercase">Total</td><td className="hidden sm:table-cell" /><td className="hidden sm:table-cell" /><td className="pt-3 text-right font-display text-xl">{clp(totalCom)}</td></tr>
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Servicios más pedidos">
          {porServicio.length === 0 ? <p className="text-sm text-zinc-600">Sin órdenes este mes.</p> : (
            <ul className="grid gap-2">
              {porServicio.map((s) => (
                <li className="grid gap-1 text-sm" key={s.nombre}>
                  <span className="flex justify-between"><span>{s.nombre}</span><strong>{s.n}</strong></span>
                  <span className="h-2 bg-zinc-200"><span className="block h-2 bg-brand" style={{ width: `${(s.n / max) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Órdenes del mes por estado">
          {porEstado.length === 0 ? <p className="text-sm text-zinc-600">Sin órdenes este mes.</p> : (
            <ul className="grid gap-2 text-sm">{porEstado.map((e) => <li className="flex justify-between" key={e.estado}><span>{e.estado}</span><strong>{e.n}</strong></li>)}</ul>
          )}
          <p className="mt-4 border-t-2 border-zinc-200 pt-3 text-sm">Garantías abiertas ahora: <strong>{garantias[0]?.n ?? 0}</strong>{' '}
            <Link className="underline" href="/ordenes?estado=Garant%C3%ADa">ver</Link></p>
        </Card>
      </div>
    </AppPage>
  );
}
