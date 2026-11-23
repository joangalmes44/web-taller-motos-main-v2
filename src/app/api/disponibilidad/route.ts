import { and, eq } from '@/db/compat';

import { db } from '@/db';
import { servicioTarifas } from '@/db/schema';
import { bloquesLibres, hoyCL, sumarDias } from '@/lib/agenda';
import { rangoDe } from '@/lib/catalogo';
import { datosDelDia } from '@/lib/reservas';

// Disponibilidad pública: solo devuelve horas libres para un servicio y cilindrada. Nunca reservas ni clientes.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const servicioId = q.get('servicio') ?? '';
  const cc = Number(q.get('cc'));
  const fecha = q.get('fecha') ?? '';
  const excluir = q.get('excluir') ?? undefined;
  const rango = rangoDe(cc);
  if (!rango) return Response.json({ error: 'Atendemos motos de 125 a 1300 cc.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return Response.json({ error: 'Elegí una fecha válida.' }, { status: 400 });
  if (fecha < hoyCL() || fecha > sumarDias(hoyCL(), 60)) return Response.json({ bloques: [], aviso: 'Podés reservar desde hoy hasta dentro de 60 días.' });
  const [d, t] = await Promise.all([
    datosDelDia(fecha, servicioId, excluir),
    db.select().from(servicioTarifas).where(and(eq(servicioTarifas.servicioId, servicioId), eq(servicioTarifas.rango, rango))).limit(1),
  ]);
  if (!d.servicio || !t[0]) return Response.json({ error: 'No encontramos ese servicio.' }, { status: 404 });
  const bloques = bloquesLibres({ fecha, dur: t[0].duracionMin, soloEquipado: d.servicio.soloPuestoEquipado, puestos: d.puestos, mecanicos: d.mecanicos, ocupadas: d.ocupadas });
  return Response.json({ bloques: bloques.map((b) => b.hora), duracionMin: t[0].duracionMin });
}
