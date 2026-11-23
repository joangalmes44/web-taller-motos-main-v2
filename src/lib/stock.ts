// Reglas de stock, bodegaje y pedidos en un solo lugar. El stock nunca se guarda: se suma desde el kardex (movimientos_stock).
import { inArray, sql, type SQL } from '@/db/compat';

import { db } from '@/db';
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

/** Bodegaje: pasados 3 días hábiles (lunes a viernes) desde que quedó «Lista para retirar», $3.000 por cada día hábil más. */
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

/** Pedido a un proveedor para una orden: compra «Enviada» (o una ya creada en esta misma tanda) con su renglón. */
export function pedidoStmts(a: { compraId: string; crearCompra: boolean; proveedorId: string; ordenId: string; ordenRepuestoId: string; repuestoId: string; cantidad: number; costo: number; nota: string; guard: SQL }) {
  const ahora = ahoraIso();
  const s: unknown[] = [];
  if (a.crearCompra) {
    s.push(db.run(sql`insert into compras (id, numero, proveedor_id, estado, orden_id, nota, creado_en, enviada_en) select ${a.compraId}, (select coalesce(max(numero),0)+1 from compras), ${a.proveedorId}, 'Enviada', ${a.ordenId}, ${a.nota}, ${ahora}, ${ahora} where ${a.guard}`));
  }
  s.push(db.run(sql`insert into compra_items (id, compra_id, repuesto_id, orden_repuesto_id, cantidad, recibida, costo_clp) select ${uuid()}, ${a.compraId}, ${a.repuestoId}, ${a.ordenRepuestoId}, ${a.cantidad}, 0, ${a.costo} where ${a.guard}`));
  return s;
}

export type ItemPlan = { repuestoId: string; cantidad: number; precio: number };

/**
 * Qué pasa con cada repuesto que se suma a una orden: con stock se reserva; especial sin stock pide abono del 50 %;
 * normal sin stock genera el pedido al proveedor. Devuelve las sentencias (todas condicionadas por `guard`).
 */
export async function planRepuestos(a: { ordenId: string; ordenNumero: string; adicionalId: string | null; items: ItemPlan[]; guard: SQL; idBase?: string }) {
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
  const stmts: unknown[] = [];
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
    const base = (estado: string) =>
      db.run(sql`insert into orden_repuestos (id, orden_id, repuesto_id, adicional_id, cantidad, precio_clp, estado) select ${orpId}, ${a.ordenId}, ${r.id}, ${a.adicionalId}, ${it.cantidad}, ${it.precio}, ${estado} where ${a.guard}`);
    if (disp >= it.cantidad) {
      stmts.push(
        base('Reservado'),
        db.run(sql`insert into movimientos_stock (id, repuesto_id, tipo, cantidad, nota, orden_id) select ${uuid()}, ${r.id}, 'reserva', ${it.cantidad}, ${`Reservado para ${a.ordenNumero}`}, ${a.ordenId} where ${a.guard}`),
      );
    } else if (r.especial) {
      const abono = Math.ceil((it.precio * it.cantidad * ABONO_ESPECIAL_PCT) / 100);
      abonoTotal += abono;
      espera = true;
      stmts.push(
        base('Esperando abono'),
        db.run(sql`insert into abonos (id, orden_id, orden_repuesto_id, concepto, requerido_clp, estado) select ${uuid()}, ${a.ordenId}, ${orpId}, ${`Abono del ${String(ABONO_ESPECIAL_PCT)} % de ${r.nombre}`}, ${abono}, 'Pendiente' where ${a.guard}`),
      );
      avisos.push(`${r.nombre} es un repuesto especial y no hay en stock: hace falta un abono de $${abono.toLocaleString('es-CL')} antes de pedirlo.`);
    } else {
      espera = true;
      const prov = r.proveedorId ?? 'prov-1';
      const ya = comprasPorProv.get(prov);
      const compraId = ya ?? (a.idBase ? `${a.idBase}:c${prov}` : uuid());
      comprasPorProv.set(prov, compraId);
      stmts.push(base('Pedido'), ...pedidoStmts({ compraId, crearCompra: !ya, proveedorId: prov, ordenId: a.ordenId, ordenRepuestoId: orpId, repuestoId: r.id, cantidad: it.cantidad, costo: r.costoClp, nota: `Pedido por ${a.ordenNumero}`, guard: a.guard }));
      avisos.push(`${r.nombre} no tiene stock: ya se pidió al proveedor.`);
    }
  }
  return { stmts, espera, abonoTotal, avisos };
}
