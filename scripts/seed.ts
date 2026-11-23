// Cuentas de prueba de Ride Service (solo base de desarrollo). `npx tsx scripts/seed.ts` — se puede repetir.
import { eq } from '@/db/compat';

import { db } from '@/db';
import { mecanicos, motos, ordenes, perfiles, recibos, users } from '@/db/schema';
import { getAuth } from '@/lib/auth';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';

if (process.env.TOTALUM_ENV !== 'dev') throw new Error('seed: solo en la base de desarrollo');

const auth = getAuth(new Request('http://localhost:3100/'));
for (const a of DEMO_ACCOUNTS) {
  let [u] = await db.select().from(users).where(eq(users.email, a.email)).limit(1);
  if (!u) {
    await auth.api.signUpEmail({ body: { email: a.email, password: DEMO_PASSWORD, name: a.nombre } });
    [u] = await db.select().from(users).where(eq(users.email, a.email)).limit(1);
  }
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, u.id));
  await db.insert(perfiles).values({ userId: u.id, rol: a.rol, nombre: a.nombre }).onConflictDoUpdate({ target: perfiles.userId, set: { rol: a.rol, nombre: a.nombre } });
  if (a.rol === 'mecanico') await db.update(mecanicos).set({ userId: u.id }).where(eq(mecanicos.id, 'mec-3'));
  console.log('ok', a.email, a.rol);
}

// Datos de ejemplo: una moto y tres órdenes ya entregadas y cobradas este mes (alimentan Informes y Garantía). Solo si no hay órdenes.
const [cli] = await db.select().from(users).where(eq(users.email, 'cliente@rideservice.demo')).limit(1);
const [hayOrdenes] = await db.select({ id: ordenes.id }).from(ordenes).limit(1);
if (cli && !hayOrdenes) {
  const ahora = new Date().toISOString();
  await db.insert(motos).values({ id: 'demo-moto-1', userId: cli.id, patente: 'KXLD42', marca: 'Honda', modelo: 'XR 190L', cc: 190, kmActual: 12400 }).onConflictDoNothing();
  const demo = [
    { n: 1, serv: 'mantencion', mec: 'mec-1', mano: 45000, rep: 18000 },
    { n: 2, serv: 'frenos', mec: 'mec-2', mano: 38000, rep: 26000 },
    { n: 3, serv: 'diagnostico', mec: 'mec-3', mano: 30000, rep: 0 },
  ];
  for (const d of demo) {
    const id = `demo-orden-${d.n}`;
    await db.insert(ordenes).values({ id, operationId: `demo-op-orden-${d.n}`, numero: d.n, userId: cli.id, motoId: 'demo-moto-1', servicioId: d.serv, puestoId: 'puesto-1', mecanicoId: d.mec, origen: 'sin_hora', estado: 'Entregada', kmIngreso: 12000, manoObraClp: d.mano, inicioPlan: ahora.slice(0, 16), finPlan: ahora.slice(0, 16), entregaEstimada: ahora.slice(0, 16), listaEn: ahora, entregadaEn: ahora }).onConflictDoNothing();
    await db.insert(recibos).values({ id: `demo-recibo-${d.n}`, numero: d.n, ordenId: id, userId: cli.id, operationId: `demo-op-recibo-${d.n}`, manoObraClp: d.mano, repuestosClp: d.rep, totalClp: d.mano + d.rep, cobradoClp: d.mano + d.rep, medioPago: 'Débito', cobradoPor: 'Daniela Fuentes' }).onConflictDoNothing();
  }
  console.log('ok datos de ejemplo');
}
