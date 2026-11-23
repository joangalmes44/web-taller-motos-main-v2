'use server';

import { and, eq, sql } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { abonos, ordenes, ordenHistorial, ordenRepuestos, repuestos } from '@/db/schema';
import { ESTADOS_CERRADOS, numeroOrden } from '@/lib/ordenes';
import { mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';
import { pedidoStmts, planRepuestos } from '@/lib/stock';
import { uuid } from '@/lib/uuid';

type Res = { ok: true; id?: string; aviso?: string } | { ok: false; error: string };
const fallo = (error: string): Res => ({ ok: false, error });
const OP = /^[\w-]{8,64}$/;
const staff = (rol: string) => rol === 'recepcion' || rol === 'administracion';
const refrescar = (id: string) => {
  for (const p of ['/ordenes', '/inventario', '/proveedores', '/caja', '/mis-motos']) revalidatePath(p);
  revalidatePath(`/ordenes/${id}`);
};

/** Suma un repuesto a la orden: con stock lo reserva; sin stock pide al proveedor (o exige abono si es especial). */
export async function agregarRepuesto(input: { ordenId: string; repuestoId: string; cantidad: number; operationId: string }): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || !staff(rol)) return fallo('Solo Recepción o Administración pueden asignar repuestos a una orden.');
  if (!OP.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const cant = Math.round(Number(input.cantidad));
  if (!Number.isFinite(cant) || cant < 1 || cant > 50) return fallo('Cargá una cantidad entre 1 y 50.');
  const [[o], [r]] = await Promise.all([
    db.select().from(ordenes).where(eq(ordenes.id, input.ordenId)).limit(1),
    db.select().from(repuestos).where(eq(repuestos.id, input.repuestoId)).limit(1),
  ]);
  if (!o) return fallo('No encontramos la orden.');
  if (!r) return fallo('Ese repuesto no está en el catálogo. Elegí otro de la lista.');
  if ((ESTADOS_CERRADOS as readonly string[]).includes(o.estado) || o.estado === 'Lista para retirar') return fallo(`La orden está «${o.estado}»: ya no admite repuestos nuevos.`);
  const [ya] = await db.select({ id: ordenRepuestos.id }).from(ordenRepuestos).where(eq(ordenRepuestos.id, `${input.operationId}:0`)).limit(1);
  if (ya) return { ok: true, id: o.id };

  const nro = numeroOrden(o.numero);
  const plan = await planRepuestos({ ordenId: o.id, ordenNumero: nro, adicionalId: null, items: [{ repuestoId: r.id, cantidad: cant, precio: r.precioClp }], guard: sql`1 = 1`, idBase: input.operationId });
  const ahora = new Date().toISOString();
  const nota = plan.espera ? `Se sumó ${String(cant)} × ${r.nombre}. ${plan.avisos.join(' ')}` : `Se reservaron ${String(cant)} × ${r.nombre} para esta orden.`;
  const pausa = plan.espera && !['Esperando aprobación', 'Esperando repuesto'].includes(o.estado);
  try {
    await db.batch([
      ...(plan.stmts as never[]),
      ...(pausa ? [db.update(ordenes).set({ estado: 'Esperando repuesto', estadoAntesRepuesto: o.estado, actualizadoEn: ahora }).where(and(eq(ordenes.id, o.id), eq(ordenes.estado, o.estado)))] : []),
      db.insert(ordenHistorial).values({ id: uuid(), ordenId: o.id, estado: pausa ? 'Esperando repuesto' : o.estado, nota, autor: session.user.name || 'Recepción' }),
    ] as never);
  } catch (e) {
    console.error('agregarRepuesto', e);
    return fallo(mensajeDeBase(e));
  }
  console.log('repuesto sumado', o.id, r.sku, cant);
  refrescar(o.id);
  return { ok: true, id: o.id, aviso: plan.espera ? plan.avisos.join(' ') : undefined };
}

/** Quita un repuesto que todavía no se usó: libera la reserva. */
export async function quitarRepuesto(ordenRepuestoId: string): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || !staff(rol)) return fallo('Solo Recepción o Administración pueden quitar repuestos.');
  const [x] = await db.select().from(ordenRepuestos).where(eq(ordenRepuestos.id, ordenRepuestoId)).limit(1);
  if (!x) return fallo('No encontramos ese repuesto en la orden. Refrescá la pantalla.');
  if (x.estado !== 'Reservado') return fallo(x.estado === 'Usado' ? 'Ese repuesto ya se descontó al cerrar la orden.' : 'Ese repuesto ya está pedido o en espera de abono: no se puede quitar desde acá.');
  try {
    await db.batch([
      db.update(ordenRepuestos).set({ estado: 'Liberado' }).where(and(eq(ordenRepuestos.id, x.id), eq(ordenRepuestos.estado, 'Reservado'))),
      db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id) select ${`lib-${x.id}`}, repuesto_id, 'liberacion', cantidad, 'Repuesto quitado de la orden', orden_id from orden_repuestos where id = ${x.id} and estado = 'Liberado'`),
    ] as never);
  } catch (e) {
    console.error('quitarRepuesto', e);
    return fallo(mensajeDeBase(e));
  }
  refrescar(x.ordenId);
  return { ok: true, id: x.ordenId };
}

/** Registra que el cliente dejó el abono en el taller: recién ahí se emite el pedido al proveedor. */
export async function registrarAbono(abonoId: string, operationId: string): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || !staff(rol)) return fallo('Solo Recepción o Administración pueden registrar abonos.');
  if (!OP.test(operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const [a] = await db.select().from(abonos).where(eq(abonos.id, abonoId)).limit(1);
  if (!a) return fallo('No encontramos ese abono. Refrescá la pantalla.');
  if (a.estado !== 'Pendiente') return a.operationId === operationId ? { ok: true, id: a.ordenId } : fallo('Ese abono ya estaba registrado. Refrescá la pantalla.');
  if (!a.ordenRepuestoId) return fallo('Este abono no está ligado a un repuesto.');
  const [[x], [o]] = await Promise.all([
    db.select({ orp: ordenRepuestos, nombre: repuestos.nombre, costo: repuestos.costoClp, proveedorId: repuestos.proveedorId }).from(ordenRepuestos).innerJoin(repuestos, eq(repuestos.id, ordenRepuestos.repuestoId)).where(eq(ordenRepuestos.id, a.ordenRepuestoId)).limit(1),
    db.select().from(ordenes).where(eq(ordenes.id, a.ordenId)).limit(1),
  ]);
  if (!x || !o) return fallo('No encontramos la orden de ese abono.');
  const ahora = new Date().toISOString();
  const guard = sql`exists (select 1 from abonos where id = ${a.id} and operation_id = ${operationId} and estado = 'Pagado')`;
  const compraId = uuid();
  const nota = `Se registró el abono de $${a.requeridoClp.toLocaleString('es-CL')} y se pidió ${x.nombre} al proveedor. Cuando llegue y se recepcione, la orden sigue sola.`;
  try {
    await db.batch([
      db.update(abonos).set({ estado: 'Pagado', pagadoClp: a.requeridoClp, operationId, pagadoEn: ahora }).where(and(eq(abonos.id, a.id), eq(abonos.estado, 'Pendiente'))),
      db.update(ordenRepuestos).set({ estado: 'Pedido' }).where(and(eq(ordenRepuestos.id, x.orp.id), eq(ordenRepuestos.estado, 'Esperando abono'), sql`${guard}`)),
      ...(pedidoStmts({ compraId, crearCompra: true, proveedorId: x.proveedorId ?? 'prov-1', ordenId: o.id, ordenRepuestoId: x.orp.id, repuestoId: x.orp.repuestoId, cantidad: x.orp.cantidad, costo: x.costo, nota: `Pedido especial ${numeroOrden(o.numero)}`, guard }) as never[]),
      db.run(sql`insert into orden_historial (id, orden_id, estado, nota, autor) select ${uuid()}, ${o.id}, ${o.estado}, ${nota}, ${session.user.name || 'Recepción'} where ${guard}`),
    ] as never);
  } catch (e) {
    console.error('registrarAbono', e);
    return fallo(mensajeDeBase(e));
  }
  console.log('abono registrado', a.id, a.requeridoClp);
  refrescar(o.id);
  return { ok: true, id: o.id };
}
