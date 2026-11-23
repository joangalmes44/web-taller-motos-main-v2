import { and, asc, desc, eq, inArray, lt, gt, ne, notInArray } from '@/db/compat';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Garantia } from './garantia';
import { ControlesMecanico, ControlesStaff, CuentaRegresiva, RespuestaAdicional, VencerAlAbrir } from './controles';

import { AutoRefresh } from '@/components/auto-refresh';
import { AppPage, Badge, Card, button } from '@/components/ui';
import { db } from '@/db';
import { adicionalRepuestos, adicionales, mecanicos, motos, ordenes, ordenHistorial, puestos, recibos, repuestos, servicios, users } from '@/db/schema';
import { ahoraCL, cuando } from '@/lib/agenda';
import { clp, horas } from '@/lib/catalogo';
import { ADICIONAL_TONO, ESTADOS_CERRADOS, ESTADOS_MECANICO, ESTADOS_STAFF, numeroOrden, ORDEN_TONO } from '@/lib/ordenes';
import { DIAS_GARANTIA } from '@/lib/garantia';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Orden de trabajo' };

const esMecPrev = (rol: string) => rol === 'mecanico';

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, rol } = await requireRol();
  const [fila, hist, adis, reps, mecs] = await db.batch([
    db
      .select({
        o: ordenes, patente: motos.patente, marca: motos.marca, modelo: motos.modelo, cc: motos.cc, servicio: servicios.nombre, puesto: puestos.numero,
        mecanico: mecanicos.nombre, mecanicoUser: mecanicos.userId, cliente: users.name,
      })
      .from(ordenes)
      .innerJoin(motos, eq(motos.id, ordenes.motoId))
      .innerJoin(servicios, eq(servicios.id, ordenes.servicioId))
      .innerJoin(puestos, eq(puestos.id, ordenes.puestoId))
      .innerJoin(users, eq(users.id, ordenes.userId))
      .leftJoin(mecanicos, eq(mecanicos.id, ordenes.mecanicoId))
      .where(eq(ordenes.id, id))
      .limit(1),
    db.select().from(ordenHistorial).where(eq(ordenHistorial.ordenId, id)).orderBy(desc(ordenHistorial.creadoEn)).limit(60),
    db.select().from(adicionales).where(eq(adicionales.ordenId, id)).orderBy(asc(adicionales.propuestoEn)).limit(30),
    db
      .select({ adicionalId: adicionalRepuestos.adicionalId, nombre: repuestos.nombre, cantidad: adicionalRepuestos.cantidad, precio: adicionalRepuestos.precioClp, especial: repuestos.especial })
      .from(adicionalRepuestos)
      .innerJoin(adicionales, eq(adicionales.id, adicionalRepuestos.adicionalId))
      .innerJoin(repuestos, eq(repuestos.id, adicionalRepuestos.repuestoId))
      .where(eq(adicionales.ordenId, id))
      .limit(100),
    db.select({ id: mecanicos.id, nombre: mecanicos.nombre }).from(mecanicos).orderBy(mecanicos.nombre),
  ]);
  const f = fila[0];
  if (!f) notFound();
  const o = f.o;
  const esStaff = rol === 'recepcion' || rol === 'administracion';
  if (rol === 'cliente' && o.userId !== user.id) notFound();
  if (rol === 'mecanico' && f.mecanicoUser !== user.id) notFound();

  let ocupados: string[] = [];
  if (esStaff) {
    const oc = await db
      .select({ m: ordenes.mecanicoId })
      .from(ordenes)
      .where(and(ne(ordenes.id, o.id), notInArray(ordenes.estado, [...ESTADOS_CERRADOS]), lt(ordenes.inicioPlan, o.finPlan), gt(ordenes.finPlan, o.inicioPlan)))
      .limit(20);
    ocupados = oc.map((x) => x.m ?? '');
  }

  const [recibo] = esMecPrev(rol) ? [] : await db.select({ id: recibos.id }).from(recibos).where(eq(recibos.ordenId, id)).limit(1);
  const ahoraIso = new Date().toISOString();
  const cerrada = (ESTADOS_CERRADOS as readonly string[]).includes(o.estado);
  const pendientes = adis.filter((a) => a.estado === 'Propuesto');
  const hayVencidos = pendientes.some((a) => a.venceEn <= ahoraIso);
  const efectivo = (a: (typeof adis)[number]) => (a.estado === 'Propuesto' && a.venceEn <= ahoraIso ? 'Vencido' : a.estado);
  const local = (iso: string) => ahoraCL(new Date(iso));
  const esMec = rol === 'mecanico';
  const bloqueado = o.estado === 'Esperando aprobación' ? 'Esperando la respuesta del cliente a un adicional. Mientras tanto no se cambia el estado.' : o.estado === 'Esperando repuesto' ? 'Esperando un repuesto del proveedor.' : cerrada ? `La orden está ${o.estado.toLowerCase()}.` : null;
  const titulo = esStaff || esMec ? `${numeroOrden(o.numero)} · ${f.patente}` : `Tu ${f.marca} ${f.modelo}`;

  return (
    <AppPage
      action={<Badge tone={ORDEN_TONO[o.estado as keyof typeof ORDEN_TONO] ?? 'gray'}>{o.estado}</Badge>}
      description={`${f.marca} ${f.modelo} · ${f.cc} cc · ${f.servicio}`}
      title={titulo}
    >
      <AutoRefresh />
      {hayVencidos && <VencerAlAbrir />}
      <Link className="text-sm font-medium underline" href={esMec ? '/mecanico' : '/ordenes'}>← Volver a {esMec ? 'mis órdenes' : 'las órdenes'}</Link>

      <Card title={rol === 'cliente' ? 'Cuándo queda lista' : 'Entrega estimada'}>
        <p className="font-display text-4xl font-semibold uppercase leading-none">{cuando(o.entregaEstimada)}</p>
        {o.entregaMovida && <p className="mt-3 rounded-sm border-2 border-accent bg-accent/30 p-3 text-sm font-medium">Esta fecha se movió: el tiempo extra aprobado no entraba en lo que quedaba del día, así que pasó al próximo horario de atención.</p>}
        {o.extraMin > 0 && !o.entregaMovida && <p className="mt-3 text-sm text-zinc-600">Incluye {horas(o.extraMin)} de trabajo adicional aprobado.</p>}
      </Card>

      {rol === 'cliente' && pendientes.length > 0 && !hayVencidos && (
        <Card title="Te falta responder">
          {pendientes.map((a) => (
            <div className="grid gap-1" key={a.id}>
              <p className="font-medium">{a.descripcion}</p>
              <p className="text-sm text-zinc-600">Tenés tiempo para responder: <CuentaRegresiva venceEn={a.venceEn} /></p>
            </div>
          ))}
          <p className="mt-2 text-sm text-zinc-600">Si no respondés, la orden sigue solo con lo que ya aprobaste.</p>
        </Card>
      )}

      <Card title="Trabajos">
        <ul className="grid gap-4">
          <li className="grid gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{f.servicio}</span><Badge tone="green">Original</Badge></div>
            <span className="text-sm text-zinc-600">{o.puestoId ? `Puesto ${String(f.puesto)}` : ''}{f.mecanico ? ` · Mecánico: ${f.mecanico}` : ' · Sin mecánico asignado todavía'}</span>
          </li>
          {adis.map((a) => {
            const ef = efectivo(a);
            const rs = reps.filter((r) => r.adicionalId === a.id);
            return (
              <li className="grid gap-1 border-t-2 border-zinc-200 pt-4" key={a.id}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">Adicional: {a.descripcion}</span><Badge tone={ADICIONAL_TONO[ef as keyof typeof ADICIONAL_TONO]}>{ef === 'Propuesto' ? 'Esperando respuesta' : ef}</Badge></div>
                <span className="text-sm text-zinc-600">Mano de obra {clp(a.manoObraClp)} · Tiempo extra {a.tiempoExtraMin > 0 ? horas(a.tiempoExtraMin) : 'sin tiempo extra'}</span>
                {rs.length > 0 && <span className="text-sm text-zinc-600">Repuestos: {rs.map((r) => `${r.cantidad} × ${r.nombre}${r.especial ? ' (especial)' : ''}${esMec ? '' : ` ${clp(r.precio)}`}`).join(', ')}</span>}
                {ef === 'Propuesto' && <span className="text-sm">Vence en <CuentaRegresiva venceEn={a.venceEn} /> ({cuando(local(a.venceEn))})</span>}
                {ef === 'Propuesto' && rol === 'cliente' && <RespuestaAdicional id={a.id} />}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 border-t-2 border-zinc-200 pt-3 text-sm text-zinc-600">Mano de obra total aprobada: <strong className="font-display text-lg text-brand">{clp(o.manoObraClp)}</strong></p>
      </Card>

      {esMec && !cerrada && (
        <Card title="Cambiar estado">
          <ControlesMecanico bloqueado={bloqueado} estado={o.estado} estados={ESTADOS_MECANICO} ordenId={o.id} />
          {!bloqueado && ['Recibida', 'En diagnóstico', 'En reparación', 'Prueba de ruta'].includes(o.estado) && (
            <Link className={`${button.primary} mt-4 min-h-16 w-full text-xl`} href={`/ordenes/${o.id}/adicional`}>Proponer trabajo adicional</Link>
          )}
        </Card>
      )}
      {esStaff && (
        <Card title="Gestión de la orden">
          <ControlesStaff
            cerrada={cerrada}
            estado={o.estado}
            estados={[...ESTADOS_STAFF]}
            mecanicoId={o.mecanicoId}
            mecanicos={mecs.map((m) => ({ ...m, ocupado: ocupados.includes(m.id) }))}
            ordenId={o.id}
          />
        </Card>
      )}

      {esStaff && (o.estado === 'Entregada' || o.estado === 'Garantía') && (
        <Card title="Garantía">
          <p className="mb-3 text-sm text-zinc-600">{o.estado === 'Garantía' ? 'La orden está en garantía: el trabajo se repite sin costo.' : `Cubre ${DIAS_GARANTIA} días desde la entrega.`}</p>
          <Garantia enGarantia={o.estado === 'Garantía'} ordenId={o.id} />
        </Card>
      )}
      {recibo && <Link className={button.secondary} href={`/recibos/${recibo.id}`}>Ver recibo</Link>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Ingreso de la moto">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-zinc-600">Kilometraje</dt><dd className="font-display text-2xl">{o.kmIngreso.toLocaleString('es-CL')} km</dd></div>
            <div><dt className="text-zinc-600">Combustible</dt><dd className="font-display text-2xl">{o.combustible}</dd></div>
            <div className="col-span-2"><dt className="text-zinc-600">Estado estético / daños previos</dt><dd>{o.danos || 'Sin daños anotados.'}</dd></div>
            {o.notas && <div className="col-span-2"><dt className="text-zinc-600">Observaciones</dt><dd>{o.notas}</dd></div>}
            {esStaff && <div className="col-span-2"><dt className="text-zinc-600">Cliente</dt><dd>{f.cliente}</dd></div>}
            <div className="col-span-2"><dt className="text-zinc-600">Ingreso</dt><dd>{o.origen === 'sin_hora' ? 'Sin hora, en el mostrador' : 'Con reserva'} · {cuando(o.inicioPlan)}</dd></div>
          </dl>
        </Card>
        <Card title="Historial">
          <ol className="grid gap-3 border-l-4 border-brand pl-4">
            {hist.map((h) => (
              <li className="relative" key={h.id}>
                <span aria-hidden className="absolute -left-[25px] top-1 size-3 border-2 border-brand bg-accent" />
                <p className="font-display text-base uppercase tracking-wide">{h.estado}</p>
                {h.nota && <p className="text-sm">{h.nota}</p>}
                <p className="text-xs text-zinc-600">{cuando(local(h.creadoEn))}{h.autor ? ` · ${h.autor}` : ''}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </AppPage>
  );
}
