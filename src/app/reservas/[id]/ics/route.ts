import { and, eq } from '@/db/compat';

import { db } from '@/db';
import { motos, reservas, servicios } from '@/db/schema';
import { TALLER, localAUtc } from '@/lib/agenda';
import { currentRol } from '@/lib/roles';

const fmt = (l: string) => localAUtc(l).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { session, rol } = await currentRol();
  if (!session) return new Response('Ingresá a tu cuenta para descargar la reserva.', { status: 401 });
  const staff = rol === 'recepcion' || rol === 'administracion';
  const [r] = await db
    .select({ id: reservas.id, inicio: reservas.inicio, fin: reservas.fin, estado: reservas.estado, servicio: servicios.nombre, marca: motos.marca, modelo: motos.modelo, patente: motos.patente })
    .from(reservas)
    .innerJoin(servicios, eq(servicios.id, reservas.servicioId))
    .innerJoin(motos, eq(motos.id, reservas.motoId))
    .where(staff ? eq(reservas.id, id) : and(eq(reservas.id, id), eq(reservas.userId, session.user.id)))
    .limit(1);
  if (!r) return new Response('No encontramos esa reserva.', { status: 404 });
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${TALLER}//Reservas//ES`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.id}@rideservice`, `DTSTAMP:${fmt(new Date().toISOString().slice(0, 16))}`, `DTSTART:${fmt(r.inicio)}`, `DTEND:${fmt(r.fin)}`,
    `SUMMARY:${TALLER}: ${r.servicio}`, `DESCRIPTION:${r.marca} ${r.modelo} (${r.patente}). Llegá unos minutos antes.`, `LOCATION:${TALLER}`,
    `STATUS:${r.estado === 'Pendiente' ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="reserva-${r.id.slice(0, 8)}.ics"` } });
}
