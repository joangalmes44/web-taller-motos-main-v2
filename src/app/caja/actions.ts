'use server';

import { eq } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db, getSupabaseAdmin } from '@/db';
import { ordenes, recibos } from '@/db/schema';
import { cobrosDe } from '@/lib/caja';
import { MEDIOS_PAGO } from '@/lib/caja-medios';
import { numeroOrden } from '@/lib/ordenes';
import { mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true; reciboId: string } | { ok: false; error: string };
const fallo = (error: string): Res => ({ ok: false, error });

/** Cobra y entrega: un recibo por orden, descuenta el stock y aplica los abonos. Repetir el envio no duplica nada. */
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
  const ahora = new Date().toISOString();
  const op = input.operationId;
  const supa = getSupabaseAdmin();

  try {
    const { data: maxRec } = await supa.from('recibos').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle();
    const nextNum = ((maxRec?.numero as number | undefined) ?? 0) + 1;

    const { error: recErr } = await supa.from('recibos').insert({
      id: reciboId,
      numero: nextNum,
      orden_id: o.id,
      user_id: o.userId,
      operation_id: op,
      mano_obra_clp: c.manoObraClp,
      repuestos_clp: c.repuestosClp,
      bodegaje_dias: c.bodegajeDias,
      bodegaje_clp: c.bodegajeClp,
      abonos_clp: c.abonosClp,
      total_clp: c.totalClp,
      cobrado_clp: c.cobrarClp,
      medio_pago: input.medio,
      cobrado_por: session.user.name || 'Recepcion',
      creado_en: ahora,
    });
    if (recErr) throw recErr;

    const { data: reservados, error: resErr } = await supa
      .from('orden_repuestos')
      .select('id, repuesto_id, cantidad, orden_id')
      .eq('orden_id', o.id)
      .eq('estado', 'Reservado');
    if (resErr) throw resErr;

    if (reservados && reservados.length > 0) {
      const movs = reservados.flatMap((r: any) => [
        {
          id: `lib-${r.id}`,
          repuesto_id: r.repuesto_id,
          tipo: 'liberacion',
          cantidad: r.cantidad,
          nota: 'Se uso en la orden',
          orden_id: r.orden_id,
          operation_id: op,
        },
        {
          id: `sal-${r.id}`,
          repuesto_id: r.repuesto_id,
          tipo: 'salida',
          cantidad: -Math.abs(Number(r.cantidad)),
          nota: `Usado en ${numeroOrden(o.numero)}`,
          orden_id: r.orden_id,
          operation_id: op,
        },
      ]);
      const { error: movErr } = await supa.from('movimientos_stock').upsert(movs, { onConflict: 'id', ignoreDuplicates: true });
      if (movErr) throw movErr;

      const { error: updRepErr } = await supa
        .from('orden_repuestos')
        .update({ estado: 'Usado' })
        .eq('orden_id', o.id)
        .eq('estado', 'Reservado');
      if (updRepErr) throw updRepErr;
    }

    await supa.from('abonos').update({ estado: 'Aplicado' }).eq('orden_id', o.id).eq('estado', 'Pagado');

    const { error: ordErr } = await supa
      .from('ordenes')
      .update({ estado: 'Entregada', entregada_en: ahora, actualizado_en: ahora })
      .eq('id', o.id)
      .eq('estado', 'Lista para retirar');
    if (ordErr) throw ordErr;

    await supa.from('orden_historial').insert({
      id: uuid(),
      orden_id: o.id,
      estado: 'Entregada',
      nota: 'Moto entregada. Gracias por confiar en Ride Service.',
      autor: session.user.name || 'Recepcion',
    });
  } catch (e) {
    console.error('cobrarOrden', e);
    const [r] = await db.select({ id: recibos.id }).from(recibos).where(eq(recibos.operationId, op)).limit(1);
    if (r) return { ok: true, reciboId: r.id };
    return fallo(mensajeDeBase(e));
  }

  for (const p of ['/caja', '/ordenes', '/inventario', '/panel', `/ordenes/${o.id}`]) revalidatePath(p);
  return { ok: true, reciboId };
}