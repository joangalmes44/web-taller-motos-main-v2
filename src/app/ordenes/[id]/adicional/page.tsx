import { eq } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FormAdicional } from './form';

import { AppPage, Card } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, motos, ordenes, repuestos } from '@/db/schema';
import { numeroOrden } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Proponer trabajo adicional' };

export default async function AdicionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireRol(['mecanico']);
  const [fila, cat] = await db.batch([
    db
      .select({ o: ordenes, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, mu: mecanicos.userId })
      .from(ordenes)
      .innerJoin(motos, eq(motos.id, ordenes.motoId))
      .leftJoin(mecanicos, eq(mecanicos.id, ordenes.mecanicoId))
      .where(eq(ordenes.id, id))
      .limit(1),
    // Sin costo de compra: el mecánico solo ve nombre, SKU y precio de venta.
    db.select({ id: repuestos.id, sku: repuestos.sku, nombre: repuestos.nombre, precio: repuestos.precioClp, especial: repuestos.especial }).from(repuestos).orderBy(repuestos.nombre).limit(200),
  ]);
  const f = fila[0];
  if (!f || f.mu !== user.id) notFound();
  return (
    <AppPage description={`${f.marca} ${f.modelo} · ${f.patente}`} title={`Adicional · ${numeroOrden(f.o.numero)}`}>
      <Link className="text-sm font-medium underline" href={`/ordenes/${id}`}>← Volver a la orden</Link>
      <Card title="Nuevo trabajo adicional">
        <FormAdicional catalogo={cat} ordenId={id} />
      </Card>
    </AppPage>
  );
}
