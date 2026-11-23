'use server';

import { and, count, eq, gte, inArray } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { motoKm, motos, reservas, servicioTarifas } from '@/db/schema';
import {
  ABONO_PENALIDAD, ACTIVAS, ahoraCL, AUSENCIAS_PARA_ABONO, CANCELAR_HORAS, cuando, diffMin, hoyCL, MESES_AUSENCIAS, puestosPara, sumarDias, sumarMin, TOLERANCIA_MIN,
} from '@/lib/agenda';
import { rangoDe } from '@/lib/catalogo';
import { datosDelDia, mensajeDeBase } from '@/lib/reservas';
import { currentRol } from '@/lib/roles';

type Res = { ok: true; id?: string } | { ok: false; error: string; refrescar?: boolean };
const fallo = (error: string, refrescar = false): Res => ({ ok: false, error, refrescar });
const esStaff = (rol: string) => rol === 'recepcion' || rol === 'administracion';

export type NuevaMoto = { patente: string; marca: string; modelo: string; cc: number; km: number };
export type CrearInput = { operationId: string; servicioId: string; inicio: string; motoId?: string; moto?: NuevaMoto };

/** Crea una reserva (o devuelve la ya creada si se repite el mismo operationId). */
export async function crearReserva(input: CrearInput): Promise<Res> {
  const { session } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para confirmar la reserva.');
  const userId = session.user.id;
  if (!/^[\w-]{8,64}$/.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  console.log('crearReserva', input.operationId);
  const [previa] = await db.select({ id: reservas.id, userId: reservas.userId }).from(reservas).where(eq(reservas.operationId, input.operationId)).limit(1);
  if (previa) return previa.userId === userId ? { ok: true, id: previa.id } : fallo('Refrescá la pantalla y probá de nuevo.');

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.inicio)) return fallo('Elegí un bloque de la grilla.', true);
  if (input.inicio <= ahoraCL()) return fallo('Ese horario ya pasó. Elegí un bloque más adelante.', true);
  if (input.inicio.slice(0, 10) > sumarDias(hoyCL(), 60)) return fallo('Reservamos hasta con 60 días de anticipación.', true);

  // moto: una propia o una nueva
  let cc: number;
  let motoId = input.motoId ?? '';
  let nueva: NuevaMoto | null = null;
  if (motoId) {
    const [m] = await db.select().from(motos).where(and(eq(motos.id, motoId), eq(motos.userId, userId))).limit(1);
    if (!m) return fallo('No encontramos esa moto en tu cuenta. Elegí otra o cargala de nuevo.');
    cc = m.cc;
  } else if (input.moto) {
    const patente = input.moto.patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
    cc = Math.round(Number(input.moto.cc));
    if (patente.length < 5 || patente.length > 8) return fallo('La patente tiene que tener entre 5 y 8 letras o números. Revisala.');
    if (!input.moto.marca.trim() || !input.moto.modelo.trim()) return fallo('Contanos la marca y el modelo de tu moto.');
    if (!rangoDe(cc)) return fallo('Atendemos motos de 125 a 1300 cc. Revisá la cilindrada.');
    const km = Math.max(0, Math.round(Number(input.moto.km) || 0));
    nueva = { patente, marca: input.moto.marca.trim().slice(0, 40), modelo: input.moto.modelo.trim().slice(0, 40), cc, km };
    motoId = crypto.randomUUID();
  } else return fallo('Elegí o cargá tu moto.');
  const rango = rangoDe(cc);
  if (!rango) return fallo('Atendemos motos de 125 a 1300 cc.');

  const dia = input.inicio.slice(0, 10);
  const [d, tar, aus, solapada] = await Promise.all([
    datosDelDia(dia, input.servicioId),
    db.select().from(servicioTarifas).where(and(eq(servicioTarifas.servicioId, input.servicioId), eq(servicioTarifas.rango, rango))).limit(1),
    db.select({ n: count() }).from(reservas).where(and(eq(reservas.userId, userId), eq(reservas.estado, 'No asistió'), gte(reservas.inicio, sumarDias(hoyCL(), -30 * MESES_AUSENCIAS)))),
    db.select({ inicio: reservas.inicio, fin: reservas.fin }).from(reservas).where(and(eq(reservas.motoId, motoId), inArray(reservas.estado, [...ACTIVAS]), gte(reservas.fin, input.inicio))),
  ]);
  const t = tar[0];
  if (!d.servicio || !t) return fallo('No encontramos ese servicio. Volvé al paso 1.');
  const fin = sumarMin(input.inicio, t.duracionMin);
  if (solapada.some((r) => r.inicio < fin && r.fin > input.inicio)) return fallo('Esa moto ya tiene una reserva en ese horario. Elegí otro bloque o reprogramá la que tenés.');

  const penal = (aus[0]?.n ?? 0) >= AUSENCIAS_PARA_ABONO;
  const candidatos = puestosPara({ inicio: input.inicio, dur: t.duracionMin, soloEquipado: d.servicio.soloPuestoEquipado, puestos: d.puestos, ocupadas: d.ocupadas });
  if (candidatos.length === 0) {
    return fallo(d.servicio.soloPuestoEquipado ? 'El Puesto 3 ya está ocupado en ese horario. Refrescá los horarios y elegí otro bloque.' : 'Ese bloque ya no tiene puestos libres. Refrescá los horarios y elegí otro.', true);
  }
  const id = crypto.randomUUID();
  let ultimo: unknown = null;
  for (const p of candidatos) {
    const insertar = db.insert(reservas).values({
      id, operationId: input.operationId, userId, motoId, servicioId: input.servicioId, puestoId: p.id, inicio: input.inicio, fin,
      duracionMin: t.duracionMin, precioClp: t.precioClp, estado: penal ? 'Pendiente' : 'Confirmada', abonoRequeridoClp: penal ? ABONO_PENALIDAD : 0,
    });
    try {
      if (nueva) {
        await db.batch([
          db.insert(motos).values({ id: motoId, userId, ...nueva, kmActual: nueva.km }),
          db.insert(motoKm).values({ id: crypto.randomUUID(), motoId, km: nueva.km, fuente: 'alta' }),
          insertar,
        ]);
      } else await insertar;
      revalidatePath('/mis-motos');
      revalidatePath('/agenda');
      console.log('reserva creada', id, p.id, input.inicio);
      return { ok: true, id };
    } catch (e) {
      ultimo = e;
      if (!String(e).includes('puesto_ocupado')) break;
      // si el lote falló, la moto nueva tampoco se guardó: la próxima vuelta la vuelve a crear
    }
  }
  console.error('crearReserva rechazada', String(ultimo));
  return fallo(mensajeDeBase(ultimo, input.inicio), true);
}

type Reserva = typeof reservas.$inferSelect;
type Acceso = { r: Reserva; staff: boolean; error?: undefined } | { r?: undefined; staff?: undefined; error: string };
async function reservaPropiaOStaff(id: string): Promise<Acceso> {
  const { session, rol } = await currentRol();
  if (!session) return { error: 'Ingresá a tu cuenta para seguir.' };
  const [r] = await db.select().from(reservas).where(eq(reservas.id, id)).limit(1);
  if (!r || (!esStaff(rol) && r.userId !== session.user.id)) return { error: 'No encontramos esa reserva.' };
  return { r, staff: esStaff(rol) };
}
const faltanHoras = (inicio: string) => diffMin(ahoraCL(), inicio) / 60;

export async function cancelarReserva(id: string): Promise<Res> {
  const x = await reservaPropiaOStaff(id);
  if (!x.r) return fallo(x.error);
  if (!['Pendiente', 'Confirmada'].includes(x.r.estado)) return fallo('Esa reserva ya no se puede cancelar.', true);
  if (!x.staff && faltanHoras(x.r.inicio) <= CANCELAR_HORAS) return fallo(`Faltan menos de ${String(CANCELAR_HORAS)} horas para tu hora, así que ya no se cancela desde acá. Escribinos por WhatsApp o pasá por el taller.`);
  await db.update(reservas).set({ estado: 'Cancelada' }).where(and(eq(reservas.id, id), inArray(reservas.estado, ['Pendiente', 'Confirmada'])));
  console.log('reserva cancelada', id);
  revalidatePath('/mis-motos');
  revalidatePath('/agenda');
  return { ok: true, id };
}

/** Mueve la reserva a otro bloque: la anterior queda «Reprogramada» y nace una nueva, todo en un solo paso atómico. */
export async function reprogramarReserva(id: string, inicio: string, operationId: string): Promise<Res> {
  const x = await reservaPropiaOStaff(id);
  if (!x.r) return fallo(x.error);
  const r = x.r;
  const [ya] = await db.select({ id: reservas.id }).from(reservas).where(eq(reservas.operationId, operationId)).limit(1);
  if (ya) return { ok: true, id: ya.id };
  if (!['Pendiente', 'Confirmada'].includes(r.estado)) return fallo('Esa reserva ya no se puede reprogramar.', true);
  if (!x.staff && faltanHoras(r.inicio) <= CANCELAR_HORAS) return fallo(`Faltan menos de ${String(CANCELAR_HORAS)} horas para tu hora, así que ya no se reprograma desde acá. Escribinos por WhatsApp o pasá por el taller.`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inicio) || inicio <= ahoraCL()) return fallo('Elegí un bloque más adelante.', true);
  const fin = sumarMin(inicio, r.duracionMin);
  const d = await datosDelDia(inicio.slice(0, 10), r.servicioId, r.id);
  if (!d.servicio) return fallo('No encontramos el servicio de esa reserva.');
  const candidatos = puestosPara({ inicio, dur: r.duracionMin, soloEquipado: d.servicio.soloPuestoEquipado, puestos: d.puestos, ocupadas: d.ocupadas });
  if (candidatos.length === 0) return fallo('Ese bloque ya está ocupado. Refrescá los horarios y elegí otro.', true);
  let ultimo: unknown = null;
  for (const p of candidatos) {
    try {
      await db.batch([
        db.update(reservas).set({ estado: 'Reprogramada' }).where(and(eq(reservas.id, r.id), eq(reservas.estado, r.estado))),
        db.insert(reservas).values({
          id: crypto.randomUUID(), operationId, userId: r.userId, motoId: r.motoId, servicioId: r.servicioId, puestoId: p.id, inicio, fin,
          duracionMin: r.duracionMin, precioClp: r.precioClp, estado: r.estado, abonoRequeridoClp: r.abonoRequeridoClp, abonoPagadoClp: r.abonoPagadoClp, reprogramadaDe: r.id,
        }),
      ]);
      const [nueva] = await db.select({ id: reservas.id }).from(reservas).where(eq(reservas.operationId, operationId)).limit(1);
      console.log('reserva reprogramada', r.id, nueva?.id);
      revalidatePath('/mis-motos');
      revalidatePath('/agenda');
      return { ok: true, id: nueva?.id };
    } catch (e) {
      ultimo = e;
      if (String(e).includes('reservas_reprog_de')) return fallo('Esa reserva ya se reprogramó. Refrescá la pantalla.', true);
      if (!String(e).includes('puesto_ocupado')) break;
    }
  }
  return fallo(mensajeDeBase(ultimo, inicio), true);
}

export async function marcarNoAsistio(id: string): Promise<Res> {
  const x = await reservaPropiaOStaff(id);
  if (!x.r) return fallo(x.error);
  if (!x.staff) return fallo('Solo Recepción puede marcar ausencias.');
  if (!['Pendiente', 'Confirmada'].includes(x.r.estado)) return fallo('Esa reserva ya no está esperando al cliente.', true);
  const pasados = diffMin(x.r.inicio, ahoraCL());
  if (pasados < TOLERANCIA_MIN) {
    const desde = sumarMin(x.r.inicio, TOLERANCIA_MIN);
    return fallo(`Todavía no pasaron los ${String(TOLERANCIA_MIN)} minutos de tolerancia: se puede marcar desde el ${cuando(desde)}.`);
  }
  await db.update(reservas).set({ estado: 'No asistió' }).where(and(eq(reservas.id, id), inArray(reservas.estado, ['Pendiente', 'Confirmada'])));
  console.log('no asistió', id);
  revalidatePath('/agenda');
  revalidatePath('/mis-motos');
  return { ok: true, id };
}

/** Recepción registra el abono manual de la penalidad y la reserva pasa a Confirmada. */
export async function registrarAbono(id: string): Promise<Res> {
  const x = await reservaPropiaOStaff(id);
  if (!x.r) return fallo(x.error);
  if (!x.staff) return fallo('Solo Recepción puede registrar abonos.');
  if (x.r.estado !== 'Pendiente') return fallo('Esa reserva no está esperando abono.', true);
  await db.update(reservas).set({ estado: 'Confirmada', abonoPagadoClp: x.r.abonoRequeridoClp }).where(and(eq(reservas.id, id), eq(reservas.estado, 'Pendiente')));
  console.log('abono registrado', id);
  revalidatePath('/agenda');
  revalidatePath('/mis-motos');
  return { ok: true, id };
}

export async function actualizarKm(motoId: string, km: number): Promise<Res> {
  const { session } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para seguir.');
  const n = Math.round(Number(km));
  const [m] = await db.select().from(motos).where(and(eq(motos.id, motoId), eq(motos.userId, session.user.id))).limit(1);
  if (!m) return fallo('No encontramos esa moto en tu cuenta.');
  if (!Number.isFinite(n) || n < m.kmActual) return fallo(`El kilometraje tiene que ser ${String(m.kmActual)} km o más. Revisá el número.`);
  if (n === m.kmActual) return { ok: true };
  await db.batch([
    db.update(motos).set({ kmActual: n }).where(eq(motos.id, motoId)),
    db.insert(motoKm).values({ id: crypto.randomUUID(), motoId, km: n, fuente: 'cliente' }),
  ]);
  revalidatePath('/mis-motos');
  return { ok: true };
}
