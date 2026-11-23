import { and, eq, gte, lt, sql } from '@/db/compat';

import { db } from '@/db';
import { mecanicos, ordenes, recibos } from '@/db/schema';
import { ahoraCL } from '@/lib/agenda';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Instante UTC (ISO) en que empieza `AAAA-MM-01` a las 00:00 en Chile (offset -3 o -4 según la fecha). */
function inicioChile(mes: string): string {
  const local = `${mes}-01T00:00`;
  for (const h of [3, 4]) {
    const t = new Date(Date.parse(`${local}:00Z`) + h * 3_600_000);
    if (ahoraCL(t) === local) return t.toISOString();
  }
  return new Date(Date.parse(`${local}:00Z`) + 3 * 3_600_000).toISOString();
}

export function rangoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  return { desde: inicioChile(mes), hasta: inicioChile(sig), nombre: `${MESES[m - 1]} de ${a}` };
}

const huboGarantia = sql`exists (select 1 from orden_historial h where h.orden_id = ${ordenes.id} and h.estado = 'Garantía')`;

/** Recibos del mes con su orden, mecánico y si la orden tuvo garantía. Los de órdenes anuladas quedan fuera. */
export function recibosDelMes(desde: string, hasta: string) {
  return db
    .select({
      numero: recibos.numero, fecha: recibos.creadoEn, orden: ordenes.numero, mecanico: mecanicos.nombre, pct: mecanicos.comisionPct,
      mano: recibos.manoObraClp, repuestos: recibos.repuestosClp, bodegaje: recibos.bodegajeClp, cobrado: recibos.cobradoClp, medio: recibos.medioPago,
      garantia: sql<number>`case when ${huboGarantia} then 1 else 0 end`,
    })
    .from(recibos)
    .innerJoin(ordenes, eq(ordenes.id, recibos.ordenId))
    .leftJoin(mecanicos, eq(mecanicos.id, ordenes.mecanicoId))
    .where(and(gte(recibos.creadoEn, desde), lt(recibos.creadoEn, hasta), sql`${ordenes.estado} <> 'Anulada'`))
    .orderBy(recibos.numero)
    .limit(2000);
}
export { huboGarantia };
