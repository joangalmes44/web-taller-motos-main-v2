'use server';

import { and, eq, inArray, lte, ne, sql } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { adicionalRepuestos, ordenRepuestos, adicionales, mecanicos, motoKm, motos, ordenes, ordenHistorial, perfiles, repuestos, reservas, servicioTarifas, users } from '@/db/schema';
import { ahoraCL, bloquesLibres, sumarMin } from '@/lib/agenda';
import { rangoDe } from '@/lib/catalogo';
import { ADICIONAL_HORAS, COMBUSTIBLE, ESTADOS_CERRADOS, ESTADOS_MECANICO, ESTADOS_STAFF, numeroOrden, recalcularEntrega } from '@/lib/ordenes';
import { datosDelDia, mensajeDeBase } from '@/lib/reservas';
import { marcarReingreso, vencerAdicionalesVencidos } from '@/lib/mantenimiento';
import { planRepuestos } from '@/lib/stock';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true; id?: string; aviso?: string } | { ok: false; error: string };
const fallo = (error: string): Res => ({ ok: false, error });
const OP = /^[\w-]{8,64}$/;
const staff = (rol: string) => rol === 'recepcion' || rol === 'administracion';
const nuevaFila = (ordenId: string, estado: string, nota: string, autor: string) => ({ id: uuid(), ordenId, estado, nota, autor });
const refrescar = (id?: string) => {
  revalidatePath('/ordenes');
  revalidatePath('/agenda');
  revalidatePath('/mecanico');
  revalidatePath('/mis-motos');
  if (id) revalidatePath(`/ordenes/${id}`);
};
const siguienteNumero = sql<number>`(select coalesce(max(numero),0)+1 from ordenes)`;

export type Checklist = { km: number; combustible: string; danos: string; notas: string; mecanicoId: string };

function revisarChecklist(c: Checklist, kmActual: number): string | null {
  if (!Number.isFinite(c.km) || c.km < 0) return 'Cargá el kilometraje que marca el tablero.';
  if (c.km < kmActual) return `El kilometraje no puede ser menor al último registrado (${kmActual.toLocaleString('es-CL')} km). Revisá el tablero.`;
  if (!(COMBUSTIBLE as readonly string[]).includes(c.combustible)) return 'Elegí el nivel de combustible.';
  return null;
}

async function mecanicoValido(id: string) {
  if (!id) return true;
  const [m] = await db.select({ id: mecanicos.id }).from(mecanicos).where(eq(mecanicos.id, id)).limit(1);
  return !!m;
}

/** Recepciona una reserva confirmada: checklist de ingreso, orden de trabajo y reserva «En taller». */
export async function recepcionarReserva(input: { operationId: string; reservaId: string } & Checklist): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para continuar.');
  if (!staff(rol)) return fallo('Solo Recepción puede recibir motos.');
  if (!OP.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const [previa] = await db.select({ id: ordenes.id }).from(ordenes).where(eq(ordenes.operationId, input.operationId)).limit(1);
  if (previa) return { ok: true, id: previa.id };
  const [r] = await db.select().from(reservas).where(eq(reservas.id, input.reservaId)).limit(1);
  if (!r) return fallo('No encontramos esa reserva. Volvé a la agenda y elegila de nuevo.');
  const [ya] = await db.select({ id: ordenes.id }).from(ordenes).where(eq(ordenes.reservaId, r.id)).limit(1);
  if (ya) return { ok: true, id: ya.id, aviso: 'Esta reserva ya estaba recibida.' };
  if (r.estado === 'Pendiente') return fallo(`Esta reserva espera un abono de $${r.abonoRequeridoClp.toLocaleString('es-CL')}. Registralo en la agenda y después recibí la moto.`);
  if (r.estado !== 'Confirmada') return fallo(`La reserva está en estado «${r.estado}»: solo se reciben reservas confirmadas. Si el cliente llegó sin hora, usá «Ingreso sin hora».`);
  const [m] = await db.select().from(motos).where(eq(motos.id, r.motoId)).limit(1);
  if (!m) return fallo('No encontramos la moto de la reserva.');
  const err = revisarChecklist(input, m.kmActual);
  if (err) return fallo(err);
  if (!(await mecanicoValido(input.mecanicoId))) return fallo('Ese mecánico no existe. Elegí otro de la lista.');

  const id = uuid();
  const autor = session.user.name || 'Recepción';
  const nota = `Recibida con ${input.km.toLocaleString('es-CL')} km, combustible ${input.combustible}.`;
  try {
    await db.batch([
      db.update(reservas).set({ estado: 'En taller' }).where(and(eq(reservas.id, r.id), eq(reservas.estado, 'Confirmada'))),
      db.insert(ordenes).values({
        id, operationId: input.operationId, numero: siguienteNumero as unknown as number, reservaId: r.id, userId: r.userId, motoId: r.motoId, servicioId: r.servicioId,
        puestoId: r.puestoId, mecanicoId: input.mecanicoId || null, origen: 'reserva', estado: 'Recibida', kmIngreso: input.km, combustible: input.combustible,
        danos: input.danos.trim().slice(0, 500), notas: input.notas.trim().slice(0, 500), manoObraClp: r.precioClp, inicioPlan: r.inicio, finPlan: r.fin, entregaEstimada: r.fin,
      }),
      db.insert(ordenHistorial).values(nuevaFila(id, 'Recibida', nota, autor)),
      db.insert(motoKm).values({ id: uuid(), motoId: m.id, km: input.km, fuente: 'recepcion' }),
      db.update(motos).set({ kmActual: input.km }).where(eq(motos.id, m.id)),
    ]);
  } catch (e) {
    console.error('recepcionarReserva', e);
    return fallo(mensajeDeBase(e));
  }
  await marcarReingreso(m.id, input.km, id);
  console.log('orden recibida', id, 'reserva', r.id);
  refrescar(id);
  return { ok: true, id };
}

export type SinHora = Checklist & {
  operationId: string; servicioId: string; nombre: string; telefono: string; patente: string; marca: string; modelo: string; cc: number;
};

/** Ingreso sin hora: busca (o crea) al cliente y la moto, ocupa el primer puesto libre de hoy y abre la orden. */
export async function ingresoSinHora(input: SinHora): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para continuar.');
  if (!staff(rol)) return fallo('Solo Recepción puede registrar ingresos sin hora.');
  if (!OP.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const [previa] = await db.select({ id: ordenes.id }).from(ordenes).where(eq(ordenes.operationId, input.operationId)).limit(1);
  if (previa) return { ok: true, id: previa.id };

  const patente = input.patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (patente.length < 5 || patente.length > 8) return fallo('La patente tiene que tener entre 5 y 8 letras o números. Revisala.');
  const [existente] = await db.select().from(motos).where(eq(motos.patente, patente)).limit(1);
  let userId = existente?.userId ?? '';
  let cc = existente?.cc ?? Math.round(Number(input.cc));
  if (!existente) {
    if (!input.nombre.trim()) return fallo('Cargá el nombre de quien deja la moto.');
    if (!input.marca.trim() || !input.modelo.trim()) return fallo('Cargá la marca y el modelo de la moto.');
  }
  const rango = rangoDe(cc);
  if (!rango) return fallo('Atendemos motos de 125 a 1300 cc. Revisá la cilindrada.');
  const err = revisarChecklist(input, existente?.kmActual ?? 0);
  if (err) return fallo(err);
  if (!(await mecanicoValido(input.mecanicoId))) return fallo('Ese mecánico no existe. Elegí otro de la lista.');

  const ahora = ahoraCL();
  const fecha = ahora.slice(0, 10);
  const [d, tar] = await Promise.all([
    datosDelDia(fecha, input.servicioId),
    db.select().from(servicioTarifas).where(and(eq(servicioTarifas.servicioId, input.servicioId), eq(servicioTarifas.rango, rango))).limit(1),
  ]);
  if (!d.servicio || !tar[0]) return fallo('Elegí el servicio que se le va a hacer.');
  const t = tar[0];
  const minAhora = Number(ahora.slice(11, 13)) * 60 + Number(ahora.slice(14, 16));
  const piso = Math.floor(minAhora / 30) * 30;
  const libres = bloquesLibres({ fecha, dur: t.duracionMin, soloEquipado: d.servicio.soloPuestoEquipado, puestos: d.puestos, mecanicos: d.mecanicos, ocupadas: d.ocupadas, ahora: '0000-00-00T00:00' })
    .filter((b) => Number(b.hora.slice(0, 2)) * 60 + Number(b.hora.slice(3)) >= piso);
  const bloque = libres[0];
  if (!bloque) {
    return fallo(d.servicio.soloPuestoEquipado
      ? 'Hoy el Puesto 3 no tiene un hueco para este servicio completo antes del cierre. Pedile al cliente que reserve otro día desde «Reservar hora».'
      : 'Hoy no queda un puesto libre con tiempo suficiente antes del cierre (o el taller está cerrado). Pedile al cliente que reserve otro día.');
  }
  const inicio = `${fecha}T${bloque.hora}`;
  const fin = sumarMin(inicio, t.duracionMin);

  const ordenId = uuid();
  const reservaId = uuid();
  const motoId = existente?.id ?? uuid();
  const autor = session.user.name || 'Recepción';
  const lote: unknown[] = [];
  if (!existente) {
    userId = uuid();
    const ahoraD = new Date();
    lote.push(
      db.insert(users).values({ id: userId, email: `mostrador-${userId.slice(0, 8)}@ride-service.local`, name: input.nombre.trim().slice(0, 80), emailVerified: false, createdAt: ahoraD, updatedAt: ahoraD }),
      db.insert(perfiles).values({ userId, rol: 'cliente', nombre: input.nombre.trim().slice(0, 80), telefono: input.telefono.trim().slice(0, 30) || null }),
      db.insert(motos).values({ id: motoId, userId, patente, marca: input.marca.trim().slice(0, 40), modelo: input.modelo.trim().slice(0, 40), cc, kmActual: 0 }),
    );
  }
  lote.push(
    db.insert(reservas).values({
      id: reservaId, operationId: input.operationId, userId, motoId, servicioId: input.servicioId, puestoId: bloque.puestoId, inicio, fin, duracionMin: t.duracionMin, precioClp: t.precioClp, estado: 'En taller',
    }),
    db.insert(ordenes).values({
      id: ordenId, operationId: input.operationId, numero: siguienteNumero as unknown as number, reservaId, userId, motoId, servicioId: input.servicioId, puestoId: bloque.puestoId,
      mecanicoId: input.mecanicoId || null, origen: 'sin_hora', estado: 'Recibida', kmIngreso: input.km, combustible: input.combustible, danos: input.danos.trim().slice(0, 500),
      notas: input.notas.trim().slice(0, 500), manoObraClp: t.precioClp, inicioPlan: inicio, finPlan: fin, entregaEstimada: fin,
    }),
    db.insert(ordenHistorial).values(nuevaFila(ordenId, 'Recibida', `Ingreso sin hora, con ${input.km.toLocaleString('es-CL')} km y combustible ${input.combustible}.`, autor)),
    db.insert(motoKm).values({ id: uuid(), motoId, km: input.km, fuente: 'recepcion' }),
    db.update(motos).set({ kmActual: input.km }).where(eq(motos.id, motoId)),
  );
  try {
    await db.batch(lote as never);
  } catch (e) {
    console.error('ingresoSinHora', e);
    return fallo(mensajeDeBase(e, inicio));
  }
  if (existente) await marcarReingreso(motoId, input.km, ordenId);
  console.log('ingreso sin hora', ordenId, 'puesto', bloque.puestoId);
  refrescar(ordenId);
  return { ok: true, id: ordenId };
}

export async function asignarMecanico(ordenId: string, mecanicoId: string): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || !staff(rol)) return fallo('Solo Recepción o Administración pueden asignar mecánicos.');
  const [o] = await db.select({ estado: ordenes.estado }).from(ordenes).where(eq(ordenes.id, ordenId)).limit(1);
  if (!o) return fallo('No encontramos la orden.');
  if ((ESTADOS_CERRADOS as readonly string[]).includes(o.estado)) return fallo('La orden ya está cerrada: no se puede cambiar el mecánico.');
  if (!(await mecanicoValido(mecanicoId))) return fallo('Ese mecánico no existe. Elegí otro de la lista.');
  try {
    const [mec] = mecanicoId ? await db.select({ nombre: mecanicos.nombre }).from(mecanicos).where(eq(mecanicos.id, mecanicoId)).limit(1) : [];
    await db.batch([
      db.update(ordenes).set({ mecanicoId: mecanicoId || null, actualizadoEn: new Date().toISOString() }).where(eq(ordenes.id, ordenId)),
      db.insert(ordenHistorial).values(nuevaFila(ordenId, o.estado, mec ? `Se asignó a ${mec.nombre}.` : 'Se quitó la asignación de mecánico.', session.user.name || 'Recepción')),
    ]);
  } catch (e) {
    console.error('asignarMecanico', e);
    return fallo(mensajeDeBase(e));
  }
  refrescar(ordenId);
  return { ok: true, id: ordenId };
}

async function mecanicoDe(userId: string) {
  const [m] = await db.select().from(mecanicos).where(eq(mecanicos.userId, userId)).limit(1);
  return m ?? null;
}

export async function cambiarEstado(ordenId: string, estado: string): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para continuar.');
  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, ordenId)).limit(1);
  if (!o) return fallo('No encontramos la orden.');
  let autor = session.user.name || 'Equipo';
  if (rol === 'mecanico') {
    const m = await mecanicoDe(session.user.id);
    if (!m || o.mecanicoId !== m.id) return fallo('Esa orden no está asignada a vos.');
    if (!(ESTADOS_MECANICO as readonly string[]).includes(estado)) return fallo('Ese estado lo cambia Recepción.');
    autor = m.nombre;
  } else if (staff(rol)) {
    if (!(ESTADOS_STAFF as readonly string[]).includes(estado)) return fallo('Ese estado todavía no se puede elegir a mano.');
  } else return fallo('No tenés permiso para cambiar el estado.');
  if (o.estado === estado) return { ok: true, id: o.id };
  if ((ESTADOS_CERRADOS as readonly string[]).includes(o.estado)) return fallo(`La orden está ${o.estado.toLowerCase()}: ya no admite cambios.`);
  if (o.estado === 'Esperando aprobación' && estado !== 'Anulada') return fallo('Hay un trabajo adicional esperando la respuesta del cliente. Cuando responda (o pasen 24 h) la orden sigue sola.');
  if (o.estado === 'Esperando repuesto' && estado !== 'Anulada') return fallo('La orden espera un repuesto. Cuando llegue la compra sigue sola.');
  const lote: unknown[] = [
    db.update(ordenes).set({ estado, actualizadoEn: new Date().toISOString(), ...(estado === 'Lista para retirar' && !o.listaEn ? { listaEn: new Date().toISOString() } : {}) }).where(and(eq(ordenes.id, o.id), eq(ordenes.estado, o.estado))),
    db.insert(ordenHistorial).values(nuevaFila(o.id, estado, estado === 'Anulada' ? 'Orden anulada.' : estado === 'Lista para retirar' ? 'Tu moto está lista. Tenés 3 días hábiles para retirarla sin costo de bodegaje.' : '', autor)),
  ];
  if (estado === 'Anulada') {
    // libera lo reservado y cancela lo que estaba por pedir
    lote.push(
      db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id) select lower(hex(randomblob(16))), repuesto_id, 'liberacion', cantidad, 'Orden anulada', orden_id from orden_repuestos where orden_id = ${o.id} and estado = 'Reservado'`),
      db.update(ordenRepuestos).set({ estado: 'Liberado' }).where(and(eq(ordenRepuestos.ordenId, o.id), inArray(ordenRepuestos.estado, ['Reservado', 'Esperando abono', 'Pedido']))),
    );
  }
  if (estado === 'Anulada' && o.reservaId) lote.push(db.update(reservas).set({ estado: 'Cancelada' }).where(and(eq(reservas.id, o.reservaId), eq(reservas.estado, 'En taller'))));
  try {
    await db.batch(lote as never);
  } catch (e) {
    console.error('cambiarEstado', e);
    return fallo(mensajeDeBase(e));
  }
  console.log('orden', o.id, o.estado, '->', estado);
  refrescar(o.id);
  return { ok: true, id: o.id };
}

export type Propuesta = { operationId: string; ordenId: string; descripcion: string; manoObraClp: number; tiempoExtraMin: number; repuestos: { id: string; cantidad: number }[] };

export async function proponerAdicional(input: Propuesta): Promise<Res> {
  const { session, rol } = await currentRol();
  if (!session || rol !== 'mecanico') return fallo('Solo el mecánico de la orden puede proponer trabajos adicionales.');
  if (!OP.test(input.operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const [previa] = await db.select({ id: adicionales.id }).from(adicionales).where(eq(adicionales.operationId, input.operationId)).limit(1);
  if (previa) return { ok: true, id: input.ordenId };
  const m = await mecanicoDe(session.user.id);
  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, input.ordenId)).limit(1);
  if (!m || !o || o.mecanicoId !== m.id) return fallo('Esa orden no está asignada a vos.');
  if (!['Recibida', 'En diagnóstico', 'En reparación', 'Prueba de ruta'].includes(o.estado)) {
    return fallo(o.estado === 'Esperando aprobación' ? 'Ya hay un adicional esperando la respuesta del cliente. Esperá su respuesta para proponer otro.' : `Con la orden en «${o.estado}» ya no se pueden proponer adicionales.`);
  }
  const desc = input.descripcion.trim();
  if (desc.length < 5) return fallo('Contá qué trabajo hay que hacer (al menos unas palabras).');
  const mano = Math.round(Number(input.manoObraClp));
  const extra = Math.round(Number(input.tiempoExtraMin));
  if (!Number.isFinite(mano) || mano < 0 || mano > 5000000) return fallo('Revisá el monto de mano de obra.');
  if (!Number.isFinite(extra) || extra < 0 || extra > 600 || extra % 30 !== 0) return fallo('El tiempo extra va de a 30 minutos.');
  if (mano === 0 && input.repuestos.length === 0) return fallo('Sumá mano de obra o al menos un repuesto.');
  const ids = [...new Set(input.repuestos.map((x) => x.id))];
  const cat = ids.length ? await db.select({ id: repuestos.id, precio: repuestos.precioClp }).from(repuestos).where(inArray(repuestos.id, ids.slice(0, 40))) : [];
  const filas = input.repuestos
    .map((x) => ({ r: cat.find((c) => c.id === x.id), cantidad: Math.round(Number(x.cantidad)) }))
    .filter((x) => x.r && x.cantidad > 0 && x.cantidad <= 50);
  if (filas.length !== input.repuestos.length) return fallo('Algún repuesto no se encontró o tiene cantidad inválida. Revisá la lista.');

  const id = uuid();
  const ahora = new Date();
  const antes = o.estado === 'Recibida' ? 'En diagnóstico' : o.estado;
  try {
    await db.batch([
      db.insert(adicionales).values({
        id, ordenId: o.id, mecanicoId: m.id, descripcion: desc.slice(0, 600), manoObraClp: mano, tiempoExtraMin: extra, estadoAntes: antes,
        propuestoEn: ahora.toISOString(), venceEn: new Date(ahora.getTime() + ADICIONAL_HORAS * 3600000).toISOString(), operationId: input.operationId,
      }),
      ...filas.map((f) => db.insert(adicionalRepuestos).values({ id: uuid(), adicionalId: id, repuestoId: f.r!.id, cantidad: f.cantidad, precioClp: f.r!.precio })),
      db.update(ordenes).set({ estado: 'Esperando aprobación', actualizadoEn: ahora.toISOString() }).where(eq(ordenes.id, o.id)),
      db.insert(ordenHistorial).values(nuevaFila(o.id, 'Esperando aprobación', `${m.nombre} propuso un trabajo adicional: ${desc.slice(0, 120)}. El cliente tiene ${ADICIONAL_HORAS} h para responder.`, m.nombre)),
    ] as never);
  } catch (e) {
    console.error('proponerAdicional', e);
    return fallo(mensajeDeBase(e));
  }
  console.log('adicional propuesto', id, 'orden', o.id);
  refrescar(o.id);
  return { ok: true, id: o.id };
}

/** El cliente aprueba o rechaza. Repetir la misma respuesta devuelve el mismo resultado sin duplicar nada. */
export async function responderAdicional(adicionalId: string, accion: 'aprobar' | 'rechazar', operationId: string): Promise<Res> {
  const { session } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta para responder.');
  if (!OP.test(operationId)) return fallo('Algo falló al enviar. Refrescá la pantalla y probá de nuevo.');
  const [a] = await db.select().from(adicionales).where(eq(adicionales.id, adicionalId)).limit(1);
  if (!a) return fallo('No encontramos ese trabajo adicional.');
  const [o] = await db.select().from(ordenes).where(and(eq(ordenes.id, a.ordenId), eq(ordenes.userId, session.user.id))).limit(1);
  if (!o) return fallo('Ese trabajo no pertenece a tus órdenes.');
  const quiere = accion === 'aprobar' ? 'Aprobado' : 'Rechazado';
  if (a.estado === quiere) return { ok: true, id: o.id };
  if (a.estado === 'Vencido') return fallo('Pasaron las 24 horas: la orden siguió con los trabajos originales. Si todavía lo querés, pedíselo al taller.');
  if (a.estado !== 'Propuesto') return fallo(`Este adicional ya fue ${a.estado.toLowerCase()}. Refrescá la pantalla.`);
  const ahoraIso = new Date().toISOString();
  if (a.venceEn <= ahoraIso) {
    await vencerAdicionales();
    return fallo('Pasaron las 24 horas: la orden siguió con los trabajos originales. Si todavía lo querés, pedíselo al taller.');
  }
  const otros = await db.select({ id: adicionales.id }).from(adicionales).where(and(eq(adicionales.ordenId, o.id), eq(adicionales.estado, 'Propuesto'), ne(adicionales.id, a.id))).limit(1);
  const aprobar = accion === 'aprobar';
  const extra = o.extraMin + (aprobar ? a.tiempoExtraMin : 0);
  const mano = o.manoObraClp + (aprobar ? a.manoObraClp : 0);
  const ent = recalcularEntrega(o.finPlan, extra);
  const guardaOp = sql`exists (select 1 from adicionales where id = ${a.id} and respuesta_op = ${operationId})`;
  const pedidos = aprobar
    ? await db.select({ repuestoId: adicionalRepuestos.repuestoId, cantidad: adicionalRepuestos.cantidad, precio: adicionalRepuestos.precioClp }).from(adicionalRepuestos).where(eq(adicionalRepuestos.adicionalId, a.id)).limit(40)
    : [];
  const plan = await planRepuestos({ ordenId: o.id, ordenNumero: numeroOrden(o.numero), adicionalId: a.id, items: pedidos.map((p) => ({ repuestoId: p.repuestoId, cantidad: p.cantidad, precio: p.precio })), guard: guardaOp });
  const estadoNuevo = plan.espera ? 'Esperando repuesto' : otros.length > 0 || o.estado !== 'Esperando aprobación' ? o.estado : a.estadoAntes;
  let nota = aprobar ? `El cliente aprobó el adicional: ${a.descripcion.slice(0, 100)}.` : `El cliente rechazó el adicional: ${a.descripcion.slice(0, 100)}. Sigue con los trabajos originales.`;
  if (plan.espera) nota += ` ${plan.avisos.join(' ')} La orden queda en «Esperando repuesto».`;
  if (aprobar && a.tiempoExtraMin > 0) nota += ent.movida ? ` La entrega se movió al ${ent.entrega.replace('T', ' a las ')}.` : ` Entrega estimada: ${ent.entrega.replace('T', ' a las ')}.`;
  const lote = [
    db.update(adicionales).set({ estado: quiere, respondidoEn: ahoraIso, respuestaOp: operationId }).where(and(eq(adicionales.id, a.id), eq(adicionales.estado, 'Propuesto'))),
    ...(plan.stmts as never[]),
    db.update(ordenes)
      .set(aprobar
        ? { manoObraClp: mano, extraMin: extra, entregaEstimada: ent.entrega, entregaMovida: ent.movida || o.entregaMovida, estado: estadoNuevo, actualizadoEn: ahoraIso, ...(plan.espera ? { estadoAntesRepuesto: a.estadoAntes } : {}) }
        : { estado: estadoNuevo, actualizadoEn: ahoraIso })
      .where(and(eq(ordenes.id, o.id), sql`exists (select 1 from adicionales where id = ${a.id} and respuesta_op = ${operationId})`)),
    db.run(sql`insert into orden_historial (id, orden_id, estado, nota, autor) select ${uuid()}, ${o.id}, ${estadoNuevo}, ${nota}, ${session.user.name || 'Cliente'} where exists (select 1 from adicionales where id = ${a.id} and respuesta_op = ${operationId})`),
  ];
  try {
    await db.batch(lote as never);
  } catch (e) {
    console.error('responderAdicional', e);
    return fallo(mensajeDeBase(e));
  }
  console.log('adicional', a.id, quiere);
  refrescar(o.id);
  revalidatePath('/inventario');
  revalidatePath('/proveedores');
  return { ok: true, id: o.id, aviso: plan.espera ? plan.avisos.join(' ') : undefined };
}

/** Pasa a «Vencido» los adicionales sin respuesta tras 24 h y devuelve la orden a lo que estaba haciendo. */
export async function vencerAdicionales(): Promise<Res> {
  const { session } = await currentRol();
  if (!session) return fallo('Ingresá a tu cuenta.');
  await vencerAdicionalesVencidos();
  return { ok: true };
}
