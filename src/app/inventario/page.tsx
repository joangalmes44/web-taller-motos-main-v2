import { sql } from '@/db/compat';
import type { Metadata } from 'next';

import { AppPage, Badge, Card } from '@/components/ui';
import { db } from '@/db';
import { movimientosStock, repuestos } from '@/db/schema';
import { clp } from '@/lib/catalogo';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Repuestos' };

export default async function InventarioPage() {
  const { rol } = await requireRol(['mecanico', 'recepcion', 'administracion']);
  const verCosto = rol !== 'mecanico';
  const [rows] = await db.batch([
    db
      .select({
        id: repuestos.id, sku: repuestos.sku, nombre: repuestos.nombre, compat: repuestos.compatibilidad,
        costo: repuestos.costoClp, precio: repuestos.precioClp, minimo: repuestos.stockMinimo, especial: repuestos.especial,
        fisico: sql<number>`coalesce(sum(case when ${movimientosStock.tipo} in ('ingreso','salida','ajuste') then ${movimientosStock.cantidad} else 0 end),0)`,
        reservado: sql<number>`coalesce(sum(case when ${movimientosStock.tipo} = 'reserva' then ${movimientosStock.cantidad} when ${movimientosStock.tipo} = 'liberacion' then -${movimientosStock.cantidad} else 0 end),0)`,
      })
      .from(repuestos)
      .leftJoin(movimientosStock, sql`${movimientosStock.repuestoId} = ${repuestos.id}`)
      .groupBy(repuestos.id)
      .orderBy(repuestos.sku)
      .limit(100),
  ]);
  const bajos = rows.filter((r) => r.fisico - r.reservado < r.minimo).length;
  return (
    <AppPage title="Repuestos y stock" description={bajos ? `${String(bajos)} repuestos están por debajo del mínimo.` : 'Todo el stock está sobre el mínimo.'}>
      <div className="grid gap-3 sm:hidden">
        {rows.map((r) => {
          const disp = r.fisico - r.reservado;
          return (
            <Card key={r.id}>
              <p className="font-display text-xs uppercase tracking-widest text-zinc-600">{r.sku}</p>
              <p className="font-medium">{r.nombre}</p>
              <p className="mt-2 font-display text-5xl font-semibold leading-none tabular-nums">{disp} <span className="font-sans text-sm font-normal text-zinc-600">disponibles</span></p>
              <div className="mt-3 flex flex-wrap gap-2">
                {disp < r.minimo ? <Badge tone="red">Bajo mínimo ({r.minimo})</Badge> : <Badge tone="green">Stock OK</Badge>}
                {r.especial && <Badge tone="amber">Especial</Badge>}
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="hidden overflow-hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 font-display text-sm uppercase tracking-wide text-zinc-700">
              <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium"><th>Repuesto</th><th>Físico</th><th>Reservado</th><th>Disponible</th><th>Mínimo</th>{verCosto && <th>Costo</th>}<th>Precio</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const disp = r.fisico - r.reservado;
                return (
                  <tr className="border-t border-zinc-200 transition-colors hover:bg-zinc-50 [&>td]:px-3 [&>td]:py-3" key={r.id}>
                    <td><span className="font-medium">{r.nombre}</span><span className="block text-xs text-zinc-600">{r.sku} · {r.compat}</span></td>
                    <td className="font-display text-xl tabular-nums">{r.fisico}</td>
                    <td className="font-display text-xl tabular-nums">{r.reservado}</td>
                    <td className="font-display text-xl tabular-nums">{disp < r.minimo ? <Badge tone="red">{disp}</Badge> : <Badge tone="green">{disp}</Badge>}</td>
                    <td>{r.minimo}</td>
                    {verCosto && <td>{clp(r.costo)}</td>}
                    <td>{clp(r.precio)}{r.especial && <span className="ml-2"><Badge tone="amber">Especial</Badge></span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </AppPage>
  );
}
