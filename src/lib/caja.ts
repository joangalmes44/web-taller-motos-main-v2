// Cálculo del cobro de una orden: mano de obra + repuestos + bodegaje − abonos ya pagados.
import { eq, inArray } from '@/db/compat';

import { db } from '@/db';
import { abonos, ordenRepuestos, repuestos } from '@/db/schema';
import { bodegaje } from '@/lib/stock';

export { MEDIOS_PAGO } from '@/lib/caja-medios';

export type Cobro = {
  ordenId: string;
  items: { id: string; nombre: string; cantidad: number; precioClp: number; estado: string }[];
  pendientes: number;
  repuestosClp: number;
  manoObraClp: number;
  bodegajeDias: number;
  bodegajeClp: number;
  abonosClp: number;
  totalClp: number;
  cobrarClp: number;
};

export async function cobrosDe(ordenes: { id: string; manoObraClp: number; listaEn: string | null }[]): Promise<Map<string, Cobro>> {
  const mapa = new Map<string, Cobro>();
  if (ordenes.length === 0) return mapa;
  const ids = ordenes.map((o) => o.id).slice(0, 60);
  const [reps, abs] = await db.batch([
    db
      .select({ id: ordenRepuestos.id, ordenId: ordenRepuestos.ordenId, nombre: repuestos.nombre, cantidad: ordenRepuestos.cantidad, precioClp: ordenRepuestos.precioClp, estado: ordenRepuestos.estado })
      .from(ordenRepuestos)
      .innerJoin(repuestos, eq(repuestos.id, ordenRepuestos.repuestoId))
      .where(inArray(ordenRepuestos.ordenId, ids))
      .limit(500),
    db.select().from(abonos).where(inArray(abonos.ordenId, ids)).limit(200),
  ]);
  for (const o of ordenes) {
    const items = reps.filter((r) => r.ordenId === o.id && (r.estado === 'Reservado' || r.estado === 'Usado'));
    const pendientes = reps.filter((r) => r.ordenId === o.id && (r.estado === 'Pedido' || r.estado === 'Esperando abono')).length;
    const repuestosClp = items.reduce((s, r) => s + r.cantidad * r.precioClp, 0);
    const b = bodegaje(o.listaEn);
    const abonosClp = abs.filter((a) => a.ordenId === o.id && a.estado === 'Pagado').reduce((s, a) => s + a.pagadoClp, 0);
    const totalClp = o.manoObraClp + repuestosClp + b.clp;
    mapa.set(o.id, { ordenId: o.id, items, pendientes, repuestosClp, manoObraClp: o.manoObraClp, bodegajeDias: b.dias, bodegajeClp: b.clp, abonosClp, totalClp, cobrarClp: Math.max(0, totalClp - abonosClp) });
  }
  return mapa;
}
