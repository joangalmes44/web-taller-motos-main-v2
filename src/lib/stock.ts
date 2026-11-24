// Reglas de stock, bodegaje y pedidos en un solo lugar. El stock nunca se guarda: se suma desde el kardex (movimientos_stock).
import { inArray, sql, type SQL } from '@/db/compat';

import { db, getSupabaseAdmin } from '@/db';
import { movimientosStock, repuestos } from '@/db/schema';
import { ahoraCL, diaSemana, sumarDias } from '@/lib/agenda';
import { uuid } from '@/lib/uuid';

export const BODEGAJE_DIAS_GRATIS = 3;
export const BODEGAJE_DIA_CLP = 3000;
export const ABONO_ESPECIAL_PCT = 50;

export const FISICO = sql<number>`coalesce(sum(case when ${movimientosStock.tipo} in ('ingreso','salida','ajuste') then ${movimientosStock.cantidad} else 0 end),0)`;
export const RESERVADO = sql<number>`coalesce(sum(case when ${movimientosStock.tipo} = 'reserva' then ${movimientosStock.cantidad} when ${movimientosStock.tipo} = 'liberacion' then -${movimientosStock.cantidad} else 0 end),0)`;

export const numeroRecibo = (n: number) => String(n).padStart(4, '0');
export const numeroCompra = (n: number) => `OC-${String(n).padStart(4, '0')}`;

export const COMPRA_TONO = { Borrador: 'gray', Enviada: 'blue', 'Recibida parcial': 'amber', Recibida: 'green', Anulada: 'gray' } as const;
export const REP_TONO = { Reservado: 'green', 'Esperando abono': 'amber', Pedido: 'amber', Usado: 'gray', Liberado: 'gray' } as const;

/** Bodegaje: pasados 3 dias habiles (lunes a viernes) desde que quedo «Lista para retirar», $3.000 por cada dia habil mas. */
export function bodegaje(listaEnIso: string | null | undefined, ahora = new Date()): { habiles: number; dias: number; clp: number; gratisHasta: string | null } {
  if (!listaEnIso) return { habiles: 0, dias: 0, clp: 0, gratisHasta: null };
  const desde = ahoraCL(new Date(listaEnIso)).slice(0, 10);
  const hoy = ahoraCL(ahora).slice(0, 10);
  const habil = (f: string) => diaSemana(f) !== 0 && diaSemana(f) !== 6;
  let habiles = 0;
  for (let d = sumarDias(desde, 1), i = 0; d <= hoy && i < 400; d = sumarDias(d, 1), i++) if (habil(d)) habiles++;
  let gratisHasta = desde;
  for (let h = 0, i = 0; h < BODEGAJE_DIAS_GRATIS && i < 40; i++) {
    gratisHasta = sumarDias(gratisHasta, 1);
    if (habil(gratisHasta)) h++;
  }
  const dias = Math.max(0, habiles - BODEGAJE_DIAS_GRATIS);
  return { habiles, dias, clp: dias * BODEGAJE_DIA_CLP, gratisHasta };
}

export async function stockDe(ids: string[]) {
  const mapa = new Map<string, { fisico: number; reservado: number; disponible: number }>();
  if (ids.length === 0) return mapa;
  const filas = await db
    .select({ id: movimientosStock.repuestoId, fisico: FISICO, reservado: RESERVADO })
    .from(movimientosStock)
    .where(inArray(movimientosStock.repuestoId, ids.slice(0, 80)))
    .groupBy(movimientosStock.repuestoId);
  for (const f of filas) mapa.set(f.id, { fisico: f.fisico, reservado: f.reservado, disponible: f.fisico - f.reservado });
  return mapa;
}

const ahoraIso = () => new Date().toISOString();
const stmt = (fn: () => Promise<void>) => ({ execute: fn });

/** Pedido a un proveedor para una orden: compra «Enviada» (o una ya creada en esta misma tanda) con su renglon. */
export function pedidoStmts(a: { compraId: string; crearCompra: boolean; proveedorId: string; ordenId: string; ordenRepuestoId: string; repuestoId: string; cantidad: number; costo: number; nota: string; guard?: SQL }) {
  const ahora = ahoraIso();
  const s: { execute: () => Promise<void> }[] = [];
  if (a.crearCompra) {
    s.push(stmt(async () => {
      const supa = getSupabaseAdmin();
      const { data: maxC } = await supa.from('compras').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle();
      const nextNum = ((maxC?.numero as number | undefined) ?? 0) + 1;
      const { error } = await supa.from('compras').upsert({
        id: a.compraId,
        numero: nextNum,
        proveedor_id: a.proveedorId,
        estado: 'Enviada',
        orden_id: a.ordenId,
        nota: a.nota,
        creado_en: ahora,
        enviada_en: ahora,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    }));
  }
  s.push(stmt(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from('compra_items').insert({
      id: uuid(),
      compra_id: a.compraId,
      repuesto_id: a.repuestoId,
      orden_repuesto_id: a.ordenRepuestoId,
      cantidad: a.cantidad,
      recibida: 0,
      costo_clp: a.costo,
    });
    if (error) throw error;
  }));
  return s;
}

export type ItemPlan = { repuestoId: string; cantidad: number; precio: number };

/**
 * Que pasa con cada repuesto que se suma a una orden: con stock se reserva; especial sin stock pide abono del 50 %;
 * normal sin stock genera el pedido al proveedor. Devuelve las sentencias ejecutables en db.batch.
 */
export async function planRepuestos(a: { ordenId: string; ordenNumero: string; adicionalId: string | null; items: ItemPlan[]; guard?: SQL; idBase?: string }) {
  const juntos = new Map<string, ItemPlan>();
  for (const it of a.items) {
    const prev = juntos.get(it.repuestoId);
    juntos.set(it.repuestoId, prev ? { ...prev, cantidad: prev.cantidad + it.cantidad } : { ...it });
  }
  const lista = [...juntos.values()];
  const ids = lista.map((x) => x.repuestoId);
  const [cat, stock] = await Promise.all([
    ids.length ? db.select().from(repuestos).where(inArray(repuestos.id, ids)) : Promise.resolve([]),
    stockDe(ids),
  ]);
  const stmts: { execute: () => Promise<void> }[] = [];
  const comprasPorProv = new Map<string, string>();
  const avisos: string[] = [];
  let espera = false;
  let abonoTotal = 0;
  let i = 0;
  for (const it of lista) {
    const r = cat.find((c) => c.id === it.repuestoId);
    if (!r) continue;
    const orpId = a.idBase ? `${a.idBase}:${String(i++)}` : uuid();
    const disp = stock.get(r.id)?.disponible ?? 0;
    const base = (estado: string) => stmt(async () => {
      const supa = getSupabaseAdmin();
      const { error } = await supa.from('orden_repuestos').upsert({
        id: orpId,
        orden_id: a.ordenId,
        repuesto_id: r.id,
        adicional_id: a.adicionalId,
        cantidad: it.cantidad,
        precio_clp: it.precio,
        estado,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    });
    if (disp >= it.cantidad) {
      stmts.push(
        base('Reservado'),
        stmt(async () => {
          const supa = getSupabaseAdmin();
          const { error } = await supa.from('movimientos_stock').insert({
            id: uuid(),
            repuesto_id: r.id,
            tipo: 'reserva',
            cantidad: it.cantidad,
            nota: `Reservado para ${a.ordenNumero}`,
            orden_id: a.ordenId,
          });
          if (error) throw error;
        }),
      );
    } else if (r.especial) {
      const abono = Math.ceil((it.precio * it.cantidad * ABONO_ESPECIAL_PCT) / 100);
      abonoTotal += abono;
      espera = true;
      stmts.push(
        base('Esperando abono'),
        stmt(async () => {
          const supa = getSupabaseAdmin();
          const { error } = await supa.from('abonos').insert({
            id: uuid(),
            orden_id: a.ordenId,
            orden_repuesto_id: orpId,
            concepto: `Abono del ${String(ABONO_ESPECIAL_PCT)} % de ${r.nombre}`,
            requerido_clp: abono,
            estado: 'Pendiente',
          });
          if (error) throw error;
        }),
      );
      avisos.push(`${r.nombre} es un repuesto especial y no hay en stock: hace falta un abono de $${abono.toLocaleString('es-CL')} antes de pedirlo.`);
    } else {
      espera = true;
      const prov = r.proveedorId ?? 'prov-1';
      const ya = comprasPorProv.get(prov);
      const compraId = ya ?? (a.idBase ? `${a.idBase}:c${prov}` : uuid());
      comprasPorProv.set(prov, compraId);
      stmts.push(base('Pedido'), ...pedidoStmts({ compraId, crearCompra: !ya, proveedorId: prov, ordenId: a.ordenId, ordenRepuestoId: orpId, repuestoId: r.id, cantidad: it.cantidad, costo: r.costoClp, nota: `Pedido por ${a.ordenNumero}` }));
      avisos.push(`${r.nombre} no tiene stock: ya se pidio al proveedor.`);
    }
  }
  return { stmts, espera, abonoTotal, avisos };
}