import { eq } from '@/db/compat';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Imprimir } from './imprimir';

import { AppPage, Card } from '@/components/ui';
import { db } from '@/db';
import { motos, ordenes, recibos } from '@/db/schema';
import { ahoraCL, cuando } from '@/lib/agenda';
import { clp } from '@/lib/catalogo';
import { numeroOrden } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';
import { numeroRecibo } from '@/lib/stock';

export const metadata: Metadata = { title: 'Recibo' };

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, rol } = await requireRol();
  const [r] = await db
    .select({ r: recibos, numeroOt: ordenes.numero, patente: motos.patente, marca: motos.marca, modelo: motos.modelo })
    .from(recibos)
    .innerJoin(ordenes, eq(ordenes.id, recibos.ordenId))
    .innerJoin(motos, eq(motos.id, ordenes.motoId))
    .where(eq(recibos.id, id))
    .limit(1);
  if (!r || (rol === 'mecanico') || (rol === 'cliente' && r.r.userId !== user.id)) notFound();
  const x = r.r;
  const fila = (t: string, v: string) => (<><dt>{t}</dt><dd className="text-right">{v}</dd></>);
  return (
    <AppPage title={`Recibo ${numeroRecibo(x.numero)}`} description="Recibo interno de Ride Service, sin valor fiscal." action={<Imprimir />}>
      <Card>
        <p className="font-medium">{numeroOrden(r.numeroOt)} · {r.marca} {r.modelo} · {r.patente}</p>
        <p className="text-sm text-zinc-600">{cuando(ahoraCL(new Date(x.creadoEn)))} · {x.medioPago}{rol !== 'cliente' ? ` · cobró ${x.cobradoPor}` : ''}</p>
        <dl className="mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 tabular-nums">
          {fila('Mano de obra', clp(x.manoObraClp))}
          {fila('Repuestos', clp(x.repuestosClp))}
          {x.bodegajeClp > 0 && fila(`Bodegaje (${x.bodegajeDias} días)`, clp(x.bodegajeClp))}
          {fila('Total', clp(x.totalClp))}
          {x.abonosClp > 0 && fila('Abonos pagados', `−${clp(x.abonosClp)}`)}
          <dt className="border-t-2 border-brand pt-1 font-display text-lg uppercase">Cobrado</dt>
          <dd className="border-t-2 border-brand pt-1 text-right font-display text-2xl">{clp(x.cobradoClp)}</dd>
        </dl>
      </Card>
    </AppPage>
  );
}
