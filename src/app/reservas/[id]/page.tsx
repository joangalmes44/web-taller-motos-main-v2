import { and, eq } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { textoReserva } from '../aviso';
import { CompartirAviso } from '../copiar-texto';

import { AppPage, Badge, Card, button } from '@/components/ui';
import { db } from '@/db';
import { motos, puestos, reservas, servicios } from '@/db/schema';
import { cuando, ESTADO_TONO } from '@/lib/agenda';
import { clp } from '@/lib/catalogo';
import { currentRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Reserva' };

export default async function ReservaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, rol } = await currentRol();
  if (!session) redirect(`/login?next=/reservas/${id}`);
  const staff = rol === 'recepcion' || rol === 'administracion';
  const [r] = await db
    .select({ id: reservas.id, inicio: reservas.inicio, fin: reservas.fin, estado: reservas.estado, precio: reservas.precioClp, abono: reservas.abonoRequeridoClp, abonoPagado: reservas.abonoPagadoClp, servicio: servicios.nombre, marca: motos.marca, modelo: motos.modelo, patente: motos.patente, puesto: puestos.numero, puestoNombre: puestos.nombre })
    .from(reservas)
    .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
    .innerJoin(motos, eq(motos.id, reservas.motoId))
    .innerJoin(puestos, eq(puestos.id, reservas.puestoId))
    .where(staff ? eq(reservas.id, id) : and(eq(reservas.id, id), eq(reservas.userId, session.user.id)))
    .limit(1);
  if (!r) notFound();
  const pendiente = r.estado === 'Pendiente';
  const texto = textoReserva({ servicio: r.servicio, moto: `${r.marca} ${r.modelo} (${r.patente})`, inicio: r.inicio, puesto: r.puesto, estado: r.estado, abono: r.abono });
  return (
    <AppPage action={<Badge tone={ESTADO_TONO[r.estado as keyof typeof ESTADO_TONO] ?? 'gray'}>{r.estado}</Badge>} description={pendiente ? 'Guardamos tu bloque. Falta el abono previo para confirmarla.' : r.estado === 'Confirmada' ? 'Listo, tu hora está confirmada.' : undefined} title={pendiente ? 'Reserva pendiente de abono' : 'Reserva'}>
      <Card title="Resumen">
        <p className="font-display text-3xl font-semibold uppercase leading-tight tracking-wide sm:text-4xl">{cuando(r.inicio)}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-600">Servicio</dt><dd className="font-medium">{r.servicio}</dd></div>
          <div><dt className="text-zinc-600">Moto</dt><dd className="font-medium">{r.marca} {r.modelo} · {r.patente}</dd></div>
          <div><dt className="text-zinc-600">Puesto asignado</dt><dd className="font-medium">Puesto {r.puesto} · {r.puestoNombre}</dd></div>
          <div><dt className="text-zinc-600">Mano de obra</dt><dd className="font-medium">{clp(r.precio)} (más repuestos, si hacen falta)</dd></div>
          {r.abono > 0 && <div><dt className="text-zinc-600">Abono previo</dt><dd className="font-medium">{clp(r.abono)} {r.abonoPagado > 0 ? '· registrado' : '· a pagar en el taller'}</dd></div>}
        </dl>
      </Card>
      {(r.estado === 'Confirmada' || pendiente) && (
        <Card title="Llevátela con vos">
          <div className="flex flex-wrap gap-3">
            <a className={button.secondary} href={`/reservas/${r.id}/ics`}>Descargar .ics</a>
          </div>
          <div className="mt-4"><CompartirAviso texto={texto} /></div>
          <pre className="mt-4 whitespace-pre-wrap rounded-sm bg-zinc-100 p-3 text-sm">{texto}</pre>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        <Link className={button.primary} href={staff ? '/agenda' : '/mis-motos'}>{staff ? 'Volver a la agenda' : 'Ver mis reservas'}</Link>
      </div>
    </AppPage>
  );
}
