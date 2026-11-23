import { and, eq } from '@/db/compat';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { Reprogramar } from './reprogramar';

import { AppPage } from '@/components/ui';
import { db } from '@/db';
import { motos, reservas, servicios } from '@/db/schema';
import { cuando, hoyCL } from '@/lib/agenda';
import { currentRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Reprogramar reserva' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, rol } = await currentRol();
  if (!session) redirect(`/login?next=/reservas/${id}/reprogramar`);
  const staff = rol === 'recepcion' || rol === 'administracion';
  const [r] = await db
    .select({ id: reservas.id, inicio: reservas.inicio, estado: reservas.estado, servicioId: reservas.servicioId, servicio: servicios.nombre, cc: motos.cc })
    .from(reservas)
    .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
    .innerJoin(motos, eq(motos.id, reservas.motoId))
    .where(staff ? eq(reservas.id, id) : and(eq(reservas.id, id), eq(reservas.userId, session.user.id)))
    .limit(1);
  if (!r) notFound();
  if (!['Pendiente', 'Confirmada'].includes(r.estado)) redirect(`/reservas/${id}`);
  return (
    <AppPage description={`${r.servicio}: hoy la tenés ${cuando(r.inicio)}. Elegí el nuevo bloque.`} title="Reprogramar reserva">
      <Reprogramar cc={r.cc} hoy={hoyCL()} id={r.id} servicioId={r.servicioId} volver={staff ? '/agenda' : '/mis-motos'} />
    </AppPage>
  );
}
