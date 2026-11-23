// Prueba automática: doble cierre (un solo recibo por orden) y límites de garantía. `npx tsx scripts/test-reglas.ts`
// Solo lee y prueba inserciones que la base debe rechazar: no deja datos. Necesita las órdenes de ejemplo (`npx tsx scripts/seed.ts`).
import { eq } from '@/db/compat';

import { db } from '@/db';
import { ordenes, recibos } from '@/db/schema';
import { DIAS_GARANTIA, KM_GARANTIA } from '@/lib/garantia';

if (process.env.TOTALUM_ENV !== 'dev') throw new Error('test-reglas: solo en la base de pruebas');
let fallos = 0;
const prueba = (nombre: string, ok: boolean) => {
  console.log(`${ok ? 'OK ' : 'FALLA'} ${nombre}`);
  if (!ok) fallos++;
};

const [orden] = await db.select().from(ordenes).where(eq(ordenes.estado, 'Entregada')).limit(1);
const [recibo] = orden ? await db.select().from(recibos).where(eq(recibos.ordenId, orden.id)).limit(1) : [];
if (!orden || !recibo) throw new Error('Faltan órdenes cobradas: corré `npx tsx scripts/seed.ts` primero.');

const antes = (await db.select({ id: recibos.id }).from(recibos)).length;
const intento = async (valores: Partial<typeof recibos.$inferInsert>) => {
  try {
    await db.insert(recibos).values({ ...recibo, id: `test-${Date.now()}-${Math.random()}`, ...valores });
    return true;
  } catch {
    return false;
  }
};
prueba('Segundo cierre con otro número de operación: rechazado', !(await intento({ operationId: `test-op-${Date.now()}`, numero: antes + 1000 })));
prueba('Reintento con la misma operación: no duplica', !(await intento({ numero: antes + 1001 })));
prueba('Cantidad de recibos sin cambios', (await db.select({ id: recibos.id }).from(recibos)).length === antes);
prueba('Garantía: 30 días y 1000 km', DIAS_GARANTIA === 30 && KM_GARANTIA === 1000);
process.exit(fallos ? 1 : 0);
