'use server';

import { eq, sql } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { compraItems, compras, recepcionesCompra } from '@/db/schema';
import { mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true } | { ok: false; error: string };

/** Recibe mercadería de una compra (parcial o total). El mismo envío repetido no suma dos veces. */
export async function recibirCompra(input: { compraId: string; operationId: string; cantidades: Record<string, number> }): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || (rol !== 'recepcion' && rol !== 'administracion')) return { ok: false, error: 'Solo Recepción o Administración pueden recibir compras.' };
  if (!/^[\w-]{8,64}$/.test(input.operationId)) return { ok: false, error: 'Algo falló al enviar. Refrescá la pantalla y probá de nuevo.' };
  const [c] = await db.select().from(compras).where(eq(compras.id, input.compraId)).limit(1);
  if (!c) return { ok: false, error: 'No encontramos la compra.' };
  if (c.estado === 'Recibida' || c.estado === 'Anulada' || c.estado === 'Borrador') return { ok: false, error: `Una compra «${c.estado}» no se puede recibir.` };
  const items = await db.select().from(compraItems).where(eq(compraItems.compraId, c.id)).limit(100);
  const recibe = items.map((i) => ({ i, q: Math.floor(Number(input.cantidades[i.id] ?? 0)) })).filter((x) => x.q > 0);
  if (recibe.length === 0) return { ok: false, error: 'Poné la cantidad que llegó en al menos un repuesto.' };
  for (const { i, q } of recibe) if (q > i.cantidad - i.recibida) return { ok: false, error: 'No podés recibir más de lo que falta pedir.' };
  const completa = items.every((i) => i.cantidad - i.recibida - (recibe.find((x) => x.i.id === i.id)?.q ?? 0) === 0);
  const ahora = new Date().toISOString();
  const op = input.operationId;
  const stmts: unknown[] = [
    db.run(sql`insert into recepciones_compra (id, compra_id, operation_id, resumen) values (${uuid()}, ${c.id}, ${op}, ${recibe.map((x) => x.q).join('+') + ' unidades'})`),
  ];
  for (const { i, q } of recibe) {
    stmts.push(db.run(sql`update compra_items set recibida = recibida + ${q} where id = ${i.id}`));
    stmts.push(db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, compra_id, operation_id) values (${uuid()}, ${i.repuestoId}, 'ingreso', ${q}, 'Recepción de compra', ${c.id}, ${op})`));
    if (i.ordenRepuestoId && q === i.cantidad - i.recibida) {
      stmts.push(db.run(sql`update orden_repuestos set estado = 'Reservado' where id = ${i.ordenRepuestoId} and estado = 'Pedido'`));
      stmts.push(db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id, operation_id) select ${uuid()}, repuesto_id, 'reserva', cantidad, 'Llegó el repuesto pedido', orden_id, ${op} from orden_repuestos where id = ${i.ordenRepuestoId} and estado = 'Reservado'`));
      stmts.push(db.run(sql`update ordenes set estado = coalesce(estado_antes_repuesto, 'En reparación'), actualizado_en = ${ahora} where id = (select orden_id from orden_repuestos where id = ${i.ordenRepuestoId}) and estado = 'Esperando repuesto' and not exists (select 1 from orden_repuestos where orden_id = ordenes.id and estado in ('Pedido','Esperando abono'))`));
    }
  }
  stmts.push(db.run(sql`update compras set estado = ${completa ? 'Recibida' : 'Recibida parcial'}, recibida_en = ${completa ? ahora : null} where id = ${c.id}`));
  try {
    await db.batch(stmts as never);
  } catch (e) {
    console.error('recibirCompra', e);
    if (await yaRecibida(op)) return { ok: true };
    return { ok: false, error: mensajeDeBase(e) };
  }
  console.log('compra recibida', c.id, completa);
  for (const p of ['/compras', '/inventario', '/ordenes', '/caja']) revalidatePath(p);
  return { ok: true };
}

async function yaRecibida(op: string) {
  const r = await db.select({ id: recepcionesCompra.id }).from(recepcionesCompra).where(eq(recepcionesCompra.operationId, op)).limit(1);
  return r.length > 0;
}
