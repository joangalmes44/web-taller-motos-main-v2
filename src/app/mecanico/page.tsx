import { and, asc, eq, notInArray } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/auto-refresh';
import { AppPage, Badge, Card, EmptyState } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, motos, ordenes, servicios } from '@/db/schema';
import { cuando } from '@/lib/agenda';
import { ESTADOS_CERRADOS, numeroOrden, ORDEN_TONO } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Mis órdenes asignadas' };

export default async function MecanicoPage() {
  const { user } = await requireRol(['mecanico']);
  const [mec] = await db.select().from(mecanicos).where(eq(mecanicos.userId, user.id)).limit(1);
  const lista = mec
    ? await db
        .select({ o: ordenes, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, servicio: servicios.nombre })
        .from(ordenes)
        .innerJoin(motos, eq(motos.id, ordenes.motoId))
        .innerJoin(servicios, eq(servicios.id, ordenes.servicioId))
        .where(and(eq(ordenes.mecanicoId, mec.id), notInArray(ordenes.estado, [...ESTADOS_CERRADOS])))
        .orderBy(asc(ordenes.inicioPlan))
        .limit(40)
    : [];
  return (
    <AppPage description={mec ? `${mec.nombre}: tus órdenes abiertas, de la más próxima a la última.` : undefined} title="Mis órdenes">
      <AutoRefresh />
      {!mec && <Card><EmptyState text="Pedile a Recepción o Administración que vincule tu cuenta con tu ficha de mecánico." title="Tu cuenta todavía no tiene ficha de mecánico" /></Card>}
      {mec && lista.length === 0 && <Card><EmptyState text="Cuando Recepción te asigne una moto, aparece acá." title="No tenés órdenes asignadas" /></Card>}
      <div className="grid gap-4">
        {lista.map(({ o, patente, marca, modelo, servicio }) => (
          <Link className="block rounded-sm border-4 border-brand bg-white p-5 shadow-poster-sm active:translate-y-0.5" href={`/ordenes/${o.id}`} key={o.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-display text-4xl font-semibold uppercase leading-none">{patente}</span>
              <Badge tone={ORDEN_TONO[o.estado as keyof typeof ORDEN_TONO] ?? 'gray'}>{o.estado}</Badge>
            </div>
            <p className="mt-3 text-lg font-medium">{marca} {modelo} · {servicio}</p>
            <p className="mt-1 text-zinc-600">{numeroOrden(o.numero)} · Entrega {cuando(o.entregaEstimada)}</p>
          </Link>
        ))}
      </div>
      <Link className="text-center font-display text-lg uppercase underline" href="/inventario">Consultar stock de repuestos</Link>
    </AppPage>
  );
}
