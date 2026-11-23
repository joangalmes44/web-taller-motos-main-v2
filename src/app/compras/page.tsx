import { desc, eq, inArray } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Recibir } from './recibir';

import { AppPage, Badge, Card, EmptyState } from '@/components/ui';
import { db } from '@/db';
import { compraItems, compras, ordenes, proveedores, repuestos } from '@/db/schema';
import { clp } from '@/lib/catalogo';
import { numeroOrden } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';
import { COMPRA_TONO, numeroCompra } from '@/lib/stock';

export const metadata: Metadata = { title: 'Compras' };

export default async function ComprasPage() {
  await requireRol(['recepcion', 'administracion']);
  const lista = await db
    .select({ c: compras, proveedor: proveedores.nombre, ot: ordenes.numero })
    .from(compras)
    .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
    .leftJoin(ordenes, eq(ordenes.id, compras.ordenId))
    .orderBy(desc(compras.creadoEn))
    .limit(30);
  const items = lista.length
    ? await db
        .select({ i: compraItems, nombre: repuestos.nombre })
        .from(compraItems)
        .innerJoin(repuestos, eq(repuestos.id, compraItems.repuestoId))
        .where(inArray(compraItems.compraId, lista.map((x) => x.c.id)))
        .limit(300)
    : [];
  return (
    <AppPage title="Compras" description="Pedidos a proveedores y recepción de lo que llega.">
      {lista.length === 0 && <EmptyState title="Todavía no hay compras" text="Se crean solas cuando una orden necesita un repuesto que no hay en stock." />}
      {lista.map(({ c, proveedor, ot }) => {
        const its = items.filter((x) => x.i.compraId === c.id);
        const abierta = c.estado === 'Enviada' || c.estado === 'Recibida parcial';
        return (
          <Card key={c.id} title={`${numeroCompra(c.numero)} · ${proveedor}`} action={<Badge tone={COMPRA_TONO[c.estado as keyof typeof COMPRA_TONO]}>{c.estado}</Badge>}>
            {ot != null && c.ordenId && <p className="text-sm text-zinc-600">Para <Link className="underline" href={`/ordenes/${c.ordenId}`}>{numeroOrden(ot)}</Link></p>}
            <ul className="mt-2 divide-y divide-zinc-200 text-sm">
              {its.map(({ i, nombre }) => (
                <li key={i.id} className="flex justify-between gap-3 py-1.5"><span className="min-w-0">{nombre}</span><span className="tabular-nums">{i.recibida}/{i.cantidad} · {clp(i.costoClp)} c/u</span></li>
              ))}
            </ul>
            {abierta && <Recibir compraId={c.id} items={its.map(({ i, nombre }) => ({ id: i.id, nombre, falta: i.cantidad - i.recibida }))} />}
          </Card>
        );
      })}
    </AppPage>
  );
}
