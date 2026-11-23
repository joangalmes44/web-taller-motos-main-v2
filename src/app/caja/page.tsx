import { asc, eq } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Cobrar } from './cobrar';

import { Badge, Card, AppPage, EmptyState } from '@/components/ui';
import { db } from '@/db';
import { motos, ordenes, users } from '@/db/schema';
import { clp } from '@/lib/catalogo';
import { cobrosDe } from '@/lib/caja';
import { numeroOrden } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Caja' };

export default async function CajaPage() {
  await requireRol(['recepcion', 'administracion']);
  const lista = await db
    .select({ o: ordenes, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, cliente: users.name })
    .from(ordenes)
    .innerJoin(motos, eq(motos.id, ordenes.motoId))
    .innerJoin(users, eq(users.id, ordenes.userId))
    .where(eq(ordenes.estado, 'Lista para retirar'))
    .orderBy(asc(ordenes.listaEn))
    .limit(30);
  const cobros = await cobrosDe(lista.map((x) => x.o));
  return (
    <AppPage title="Caja" description="Motos listas para retirar: cobrá, entregá y emití el recibo interno.">
      {lista.length === 0 && <EmptyState title="No hay motos para cobrar" text="Cuando una orden quede «Lista para retirar» aparece acá." />}
      {lista.map(({ o, patente, marca, modelo, cliente }) => {
        const c = cobros.get(o.id)!;
        return (
          <Card key={o.id} title={<Link href={`/ordenes/${o.id}`} className="underline">{numeroOrden(o.numero)}</Link>} action={c.bodegajeClp > 0 ? <Badge tone="red">Bodegaje {c.bodegajeDias} d</Badge> : undefined}>
            <p className="font-medium">{marca} {modelo} · {patente}</p>
            <p className="text-sm text-zinc-600">{cliente}</p>
            <dl className="mt-3 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
              <dt>Mano de obra</dt><dd className="text-right">{clp(c.manoObraClp)}</dd>
              {c.items.map((i) => (<><dt key={i.id}>{i.cantidad} × {i.nombre}</dt><dd className="text-right">{clp(i.cantidad * i.precioClp)}</dd></>))}
              {c.bodegajeClp > 0 && (<><dt>Bodegaje ({c.bodegajeDias} días)</dt><dd className="text-right">{clp(c.bodegajeClp)}</dd></>)}
              {c.abonosClp > 0 && (<><dt>Abonos pagados</dt><dd className="text-right">−{clp(c.abonosClp)}</dd></>)}
              <dt className="border-t-2 border-brand pt-1 font-display text-lg uppercase">A cobrar</dt>
              <dd className="border-t-2 border-brand pt-1 text-right font-display text-2xl">{clp(c.cobrarClp)}</dd>
            </dl>
            {c.pendientes > 0 && <p className="mt-3 text-sm font-medium">Faltan {c.pendientes} repuesto(s) por llegar antes de entregar.</p>}
            <Cobrar ordenId={o.id} disabled={c.pendientes > 0} />
          </Card>
        );
      })}
    </AppPage>
  );
}
