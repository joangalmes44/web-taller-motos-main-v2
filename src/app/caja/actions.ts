'use server';

import { eq } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db, getSupabaseAdmin } from '@/db';
import { ordenes, recibos } from '@/db/schema';
import { cobrosDe } from '@/lib/caja';
import { MEDIOS_PAGO } from '@/lib/caja-medios';
import { mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true; reciboId: string } | { ok: false; error: string };
const fallo = (error: string): Res => ({ ok: false, error });

/** Cobra y entrega en una sola transaccion atomica en Supabase (recibo + descuento de stock + abonos + estado Entregada). */
export async function cobrarOrden(input: { ordenId: string; operationId: string; medio: string }): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || (rol !== 'recepcion' && rol !== 'administracion')) return fallo('Solo Recepcion o Administracion pueden cobrar.');
  if (!/^[\w-]{8,64}$/.test(input.operationId)) return fallo('Algo fallo al enviar. Refresca la pantalla y proba de nuevo.');
  if (!(MEDIOS_PAGO as readonly string[]).includes(input.medio)) return fallo('Elegi un medio de pago.');

  const [previo] = await db.select({ id: recibos.id, op: recibos.operationId }).from(recibos).where(eq(recibos.ordenId, input.ordenId)).limit(1);
  if (previo) return previo.op === input.operationId ? { ok: true, reciboId: previo.id } : fallo('Esta orden ya fue cobrada. Abri su recibo desde la orden.');

  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, input.ordenId)).limit(1);
  if (!o) return fallo('No encontramos la orden. Refresca la pantalla.');
  if (o.estado !== 'Lista para retirar') return fallo('Solo se cobran ordenes en «Lista para retirar».');

  const c = (await cobrosDe([o])).get(o.id);
  if (!c) return fallo('No pudimos calcular el cobro.');
  if (c.pendientes > 0) return fallo('Hay repuestos pedidos que todavia no llegaron.');

  const reciboId = uuid();
  const op = input.operationId;
  const supa = getSupabaseAdmin();

  try {
    const { data, error } = await supa.rpc('cobrar_orden_atomico', {
      p_recibo_id: reciboId,
      p_orden_id: o.id,
      p_operation_id: op,
      p_mano_obra_clp: c.manoObraClp,
      p_repuestos_clp: c.repuestosClp,
      p_bodegaje_dias: c.bodegajeDias,
      p_bodegaje_clp: c.bodegajeClp,
      p_abonos_clp: c.abonosClp,
      p_total_clp: c.totalClp,
      p_cobrado_clp: c.cobrarClp,
      p_medio_pago: input.medio,
      p_cobrado_por: session.user.name || 'Recepcion',
    });
    if (error) throw error;
    const finalId = typeof data === 'string' && data ? data : reciboId;
    for (const p of ['/caja', '/ordenes', '/inventario', '/panel', `/ordenes/${o.id}`]) revalidatePath(p);
    return { ok: true, reciboId: finalId };
  } catch (e: any) {
    console.error('cobrarOrden', e);
    const msg = String(e?.message ?? e);
    if (msg.includes('orden_ya_cobrada')) return fallo('Esta orden ya fue cobrada. Abri su recibo desde la orden.');
    const [r] = await db.select({ id: recibos.id }).from(recibos).where(eq(recibos.operationId, op)).limit(1);
    if (r) return { ok: true, reciboId: r.id };
    return fallo(mensajeDeBase(e));
  }
}