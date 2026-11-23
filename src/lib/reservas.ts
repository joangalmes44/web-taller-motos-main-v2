import { and, eq, inArray, like, ne } from '@/db/compat';

import { db } from '@/db';
import { mecanicos, puestos, reservas, servicios } from '@/db/schema';
import { ACTIVAS, cuando, sumarMin, type Ocupada, type PuestoInfo } from '@/lib/agenda';

/** Puestos, cantidad de mecánicos, servicio y reservas activas del día, en un solo viaje a la base. */
export async function datosDelDia(fecha: string, servicioId: string, excluirId?: string) {
  const [pu, mec, sv, oc] = await db.batch([
    db.select().from(puestos).orderBy(puestos.numero),
    db.select({ id: mecanicos.id }).from(mecanicos),
    db.select().from(servicios).where(eq(servicios.id, servicioId)).limit(1),
    db
      .select({ id: reservas.id, puestoId: reservas.puestoId, inicio: reservas.inicio, fin: reservas.fin })
      .from(reservas)
      .where(and(like(reservas.inicio, `${fecha}%`), inArray(reservas.estado, [...ACTIVAS]), excluirId ? ne(reservas.id, excluirId) : undefined)),
  ]);
  const puestosInfo: PuestoInfo[] = pu.map((p) => ({ id: p.id, numero: p.numero, equipado: p.equipado }));
  const ocupadas: Ocupada[] = oc.map((o) => ({ puestoId: o.puestoId, inicio: o.inicio, fin: o.fin }));
  return { puestos: puestosInfo, mecanicos: mec.length, servicio: sv[0] ?? null, ocupadas };
}

/** Traduce el rechazo de la base a un mensaje que dice qué hacer. */
export function mensajeDeBase(err: unknown, inicio?: string): string {
  const txt = [String(err), String((err as { cause?: unknown })?.cause ?? '')].join(' ');
  if (txt.includes('puesto_ocupado')) return `Ese bloque${inicio ? ` (${cuando(inicio)})` : ''} se acaba de ocupar. Refrescá los horarios y elegí otro.`;
  if (txt.includes('sin_mecanico')) return 'En ese horario ya están ocupados los tres mecánicos. Refrescá los horarios y probá con otro bloque.';
  if (txt.includes('horario_invalido')) return 'Ese horario queda fuera de los días y horas de atención: lunes a viernes 11:00 a 20:00 y sábados 11:00 a 16:00. Elegí otro bloque.';
  if (txt.includes('cc_fuera_de_rango')) return 'Atendemos motos de 125 a 1300 cc. Revisá la cilindrada.';
  if (txt.includes('puesto_incompatible')) return 'Ese servicio solo se hace en el Puesto 3, que es el equipado. Elegí otro bloque.';
  if (txt.includes('UNIQUE') && txt.includes('patente')) return 'Esa patente ya está cargada en otra cuenta. Revisá que esté bien escrita o escribinos para ayudarte.';
  if (txt.includes('mecanico_ocupado')) return 'Ese mecánico ya tiene otra orden en ese mismo horario (cada uno trabaja una a la vez). Elegí otro mecánico o dejá la orden sin asignar por ahora.';
  if (txt.includes('stock_agotado')) return 'Otra persona acaba de reservar el último repuesto disponible. Refrescá la pantalla para ver el stock actual: si ya no alcanza, se pide al proveedor.';
  if (txt.includes('stock_negativo')) return 'El stock físico no alcanza para descontar este repuesto, y no se permite dejarlo en negativo. Revisá el inventario (puede faltar registrar una compra o un ajuste) y probá de nuevo.';
  if (txt.includes('recepcion_excede')) return 'Esa compra ya recibió esas unidades (otra sesión la acaba de recibir). Refrescá la pantalla para ver lo que falta recibir.';
  if (txt.includes('km_menor')) return 'El kilometraje no puede ser menor al último que cargaste.';
  return 'No pudimos guardar el cambio. Refrescá la pantalla y probá de nuevo.';
}

export const finDe = (inicio: string, dur: number) => sumarMin(inicio, dur);
