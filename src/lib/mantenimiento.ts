// Procesos automáticos: no asistió, adicionales vencidos y reingresos en garantía. Se ejecutan por tarea programada.
import { and, desc, eq, inArray, lte } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { adicionales, ordenes, ordenHistorial, reservas } from '@/db/schema';
import { ahoraCL, sumarMin, TOLERANCIA_MIN } from '@/lib/agenda';
import { DIAS_GARANTIA, KM_GARANTIA } from '@/lib/garantia';
import { ADICIONAL_HORAS } from '@/lib/ordenes';
import { uuid } from '@/lib/uuid';

const fila = (ordenId: string, estado: string, nota: string, autor: string) => ({ id: uuid(), ordenId, estado, nota, autor });

/** Pasa a «Vencido» los adicionales sin respuesta tras 24 h y devuelve la orden a lo que estaba haciendo. */
export async function vencerAdicionalesVencidos(): Promise<number> {
  const ahoraIso = new Date().toISOString();
  const vencidos = await db
    .update(adicionales)
    .set({ estado: 'Vencido', respondidoEn: ahoraIso })
    .where(and(eq(adicionales.estado, 'Propuesto'), lte(adicionales.venceEn, ahoraIso)))
    .returning({ id: adicionales.id, ordenId: adicionales.ordenId, antes: adicionales.estadoAntes });
  for (const v of vencidos) {
    const quedan = await db.select({ id: adicionales.id }).from(adicionales).where(and(eq(adicionales.ordenId, v.ordenId), eq(adicionales.estado, 'Propuesto'))).limit(1);
    const [o] = await db.select({ estado: ordenes.estado }).from(ordenes).where(eq(ordenes.id, v.ordenId)).limit(1);
    const vuelve = quedan.length === 0 && o?.estado === 'Esperando aprobación';
    await db.batch([
      ...(vuelve ? [db.update(ordenes).set({ estado: v.antes, actualizadoEn: ahoraIso }).where(and(eq(ordenes.id, v.ordenId), eq(ordenes.estado, 'Esperando aprobación')))] : []),
      db.insert(ordenHistorial).values(fila(v.ordenId, vuelve ? v.antes : (o?.estado ?? v.antes), `Pasaron ${ADICIONAL_HORAS} h sin respuesta del cliente: el adicional venció y la orden sigue solo con los trabajos originales.`, 'Sistema')),
    ] as never);
    revalidatePath(`/ordenes/${v.ordenId}`);
  }
  if (vencidos.length) {
    console.log('adicionales vencidos', vencidos.length);
    revalidatePath('/ordenes');
  }
  return vencidos.length;
}

/** Marca «No asistió» las reservas sin llegada pasados los minutos de tolerancia. */
export async function marcarAusentes(): Promise<number> {
  const limite = sumarMin(ahoraCL(), -TOLERANCIA_MIN);
  const r = await db
    .update(reservas)
    .set({ estado: 'No asistió' })
    .where(and(inArray(reservas.estado, ['Pendiente', 'Confirmada']), lte(reservas.inicio, limite)))
    .returning({ id: reservas.id });
  if (r.length) {
    console.log('no asistió automático', r.length);
    revalidatePath('/agenda');
    revalidatePath('/mis-motos');
  }
  return r.length;
}

/** Si la moto vuelve dentro de 30 días de la entrega y de 1000 km del ingreso anterior, la orden anterior pasa a Garantía. */
export async function marcarReingreso(motoId: string, km: number, nuevaOrdenId: string): Promise<boolean> {
  try {
    const [prev] = await db
      .select({ id: ordenes.id, km: ordenes.kmIngreso, entregada: ordenes.entregadaEn, act: ordenes.actualizadoEn })
      .from(ordenes)
      .where(and(eq(ordenes.motoId, motoId), eq(ordenes.estado, 'Entregada')))
      .orderBy(desc(ordenes.creadoEn))
      .limit(1);
    if (!prev) return false;
    const dias = (Date.now() - new Date(prev.entregada ?? prev.act).getTime()) / 86_400_000;
    const recorridos = km - prev.km;
    if (dias > DIAS_GARANTIA || recorridos < 0 || recorridos > KM_GARANTIA) return false;
    const nota = `Reingreso automático: la moto volvió a los ${Math.floor(dias)} días y ${recorridos.toLocaleString('es-CL')} km de la entrega. Se revisa como garantía (nueva orden asociada).`;
    await db.batch([
      db.update(ordenes).set({ estado: 'Garantía', actualizadoEn: new Date().toISOString() }).where(and(eq(ordenes.id, prev.id), eq(ordenes.estado, 'Entregada'))),
      db.insert(ordenHistorial).values(fila(prev.id, 'Garantía', nota, 'Sistema')),
      db.insert(ordenHistorial).values(fila(nuevaOrdenId, 'Recibida', 'Reingreso dentro de la garantía de la orden anterior.', 'Sistema')),
    ]);
    console.log('reingreso en garantía', prev.id, '->', nuevaOrdenId);
    revalidatePath(`/ordenes/${prev.id}`);
    revalidatePath('/informes');
    return true;
  } catch (e) {
    console.error('marcarReingreso', e);
    return false;
  }
}
