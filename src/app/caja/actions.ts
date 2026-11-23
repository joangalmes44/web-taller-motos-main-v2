'use server';

import { eq, sql } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { ordenes, recibos } from '@/db/schema';
import { cobrosDe } from '@/lib/caja';
import { MEDIOS_PAGO } from '@/lib/caja-medios';
import { numeroOrden } from '@/lib/ordenes';
import { mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true; reciboId: string } | { ok: false; error: string };
const fallo = (error: string): Res => ({ ok: false, error });

/** Cobra y entrega: un recibo por orden, descuenta el stock y aplica los abonos. Repetir el envío no duplica nada. */
export async function cobrarOrden(input: { ordenId: string; operationId: string; medio: string }): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || (rol !== 'recepcion' && rol !== 'administracion')) return fallo('Solo Recepción o Administración pueden cobrar.');
  if (!/^[\w-]{8,64}$/.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  if (!(MEDIOS_PAGO as readonly string[]).includes(input.medio)) return fallo('Elegí un medio de pago.');
  const [previo] = await db.select({ id: recibos.id, op: recibos.operationId }).from(recibos).where(eq(recibos.ordenId, input.ordenId)).limit(1);
  if (previo) return previo.op === input.operationId ? { ok: true, reciboId: previo.id } : fallo('Esta orden ya fue cobrada. Abrí su recibo desde la orden.');
  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, input.ordenId)).limit(1);
  if (!o) return fallo('No encontramos la orden. Refrescá la pantalla.');
  if (o.estado !== 'Lista para retirar') return fallo('Solo se cobran órdenes en «Lista para retirar».');
  const c = (await cobrosDe([o])).get(o.id);
  if (!c) return fallo('No pudimos calcular el cobro.');
  if (c.pendientes > 0) return fallo('Hay repuestos pedidos que todavía no llegaron.');
  const reciboId = uuid();
  const ahora = new Date().toISOString();
  const op = input.operationId;
  const guard = sql`exists (select 1 from recibos where id = ${reciboId} and operation_id = ${op})`;
  try {
    await db.batch([
      db.run(sql`insert into recibos (id, numero, orden_id, user_id, operation_id, mano_obra_clp, repuestos_clp, bodegaje_dias, bodegaje_clp, abonos_clp, total_clp, cobrado_clp, medio_pago, cobrado_por, creado_en)
        select ${reciboId}, (select coalesce(max(numero),0)+1 from recibos), id, user_id, ${op}, ${c.manoObraClp}, ${c.repuestosClp}, ${c.bodegajeDias}, ${c.bodegajeClp}, ${c.abonosClp}, ${c.totalClp}, ${c.cobrarClp}, ${input.medio}, ${session.user.name || 'Recepción'}, ${ahora}
        from ordenes where id = ${o.id} and estado = 'Lista para retirar'`),
      db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id, operation_id) select 'lib-' || id, repuesto_id, 'liberacion', cantidad, 'Se usó en la orden', orden_id, ${op} from orden_repuestos where orden_id = ${o.id} and estado = 'Reservado' and ${guard}`),
      db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id, operation_id) select 'sal-' || id, repuesto_id, 'salida', -cantidad, 'Usado en ' || ${numeroOrden(o.numero)}, orden_id, ${op} from orden_repuestos where orden_id = ${o.id} and estado = 'Reservado' and ${guard}`),
      db.run(sql`update orden_repuestos set estado = 'Usado' where orden_id = ${o.id} and estado = 'Reservado' and ${guard}`),
      db.run(sql`update abonos set estado = 'Aplicado' where orden_id = ${o.id} and estado = 'Pagado' and ${guard}`),
      db.run(sql`update ordenes set estado = 'Entregada', entregada_en = ${ahora}, actualizado_en = ${ahora} where id = ${o.id} and estado = 'Lista para retirar' and ${guard}`),
      db.run(sql`insert into orden_historial (id, orden_id, estado, nota, autor) select ${uuid()}, ${o.id}, 'Entregada', 'Moto entregada. Gracias por confiar en Ride Service.', ${session.user.name || 'Recepción'} where ${guard}`),
    ] as never);
  } catch (e) {
    console.error('cobrarOrden', e);
    const [r] = await db.select({ id: recibos.id }).from(recibos).where(eq(recibos.operationId, op)).limit(1);
    if (r) return { ok: true, reciboId: r.id };
    return fallo(mensajeDeBase(e));
  }
  console.log('orden cobrada', o.id, c.cobrarClp);
  for (const p of ['/caja', '/ordenes', '/inventario', '/panel', `/ordenes/${o.id}`]) revalidatePath(p);
  return { ok: true, reciboId };
}
