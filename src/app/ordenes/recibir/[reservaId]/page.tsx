import { and, eq, gt, lt, notInArray } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FormIngreso } from '../../form-ingreso';

import { AppPage, Card } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, motos, ordenes, reservas, servicios } from '@/db/schema';
import { cuando } from '@/lib/agenda';
import { ESTADOS_CERRADOS } from '@/lib/ordenes';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Recibir moto' };

export default async function RecibirPage({ params }: { params: Promise<{ reservaId: string }> }) {
  await requireRol(['recepcion', 'administracion']);
  const { reservaId } = await params;
  const [r] = await db
    .select({ r: reservas, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, km: motos.kmActual, servicio: servicios.nombre })
    .from(reservas)
    .innerJoin(motos, eq(motos.id, reservas.motoId))
    .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
    .where(eq(reservas.id, reservaId))
    .limit(1);
  if (!r) notFound();
  const [ya] = await db.select({ id: ordenes.id }).from(ordenes).where(eq(ordenes.reservaId, reservaId)).limit(1);
  if (ya) redirect(`/ordenes/${ya.id}`);
  const [mecs, oc] = await db.batch([
    db.select({ id: mecanicos.id, nombre: mecanicos.nombre }).from(mecanicos).orderBy(mecanicos.nombre),
    db.select({ m: ordenes.mecanicoId }).from(ordenes).where(and(notInArray(ordenes.estado, [...ESTADOS_CERRADOS]), lt(ordenes.inicioPlan, r.r.fin), gt(ordenes.finPlan, r.r.inicio))).limit(20),
  ]);
  const ocupados = oc.map((x) => x.m);
  const recibible = r.r.estado === 'Confirmada';
  return (
    <AppPage description={`${r.marca} ${r.modelo} · ${r.patente} · ${r.servicio} · ${cuando(r.r.inicio)}`} title="Recibir moto">
      <Link className="text-sm font-medium underline" href="/agenda">← Volver a la agenda</Link>
      <Card title="Checklist de ingreso">
        {recibible ? (
          <FormIngreso kmMinimo={r.km} mecanicos={mecs.map((m) => ({ ...m, ocupado: ocupados.includes(m.id) }))} reservaId={reservaId} />
        ) : (
          <p className="font-medium">Esta reserva está «{r.r.estado}»{r.r.estado === 'Pendiente' ? ': registrá primero el abono en la agenda.' : ': solo se reciben reservas confirmadas.'}</p>
        )}
      </Card>
    </AppPage>
  );
}
