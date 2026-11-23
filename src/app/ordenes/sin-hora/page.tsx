import type { Metadata } from 'next';
import Link from 'next/link';

import { FormIngreso } from '../form-ingreso';

import { AppPage, Card } from '@/components/ui';
import { db } from '@/db';
import { mecanicos, servicios } from '@/db/schema';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Ingreso sin hora' };

export default async function SinHoraPage() {
  await requireRol(['recepcion', 'administracion']);
  const [sv, mecs] = await db.batch([
    db.select({ id: servicios.id, nombre: servicios.nombre }).from(servicios).orderBy(servicios.orden),
    db.select({ id: mecanicos.id, nombre: mecanicos.nombre }).from(mecanicos).orderBy(mecanicos.nombre),
  ]);
  return (
    <AppPage description="Alguien llegó sin reserva: le damos el primer puesto libre de hoy y abrimos la orden." title="Ingreso sin hora">
      <Link className="text-sm font-medium underline" href="/agenda">← Volver a la agenda</Link>
      <Card title="Datos del ingreso"><FormIngreso mecanicos={mecs} servicios={sv} /></Card>
    </AppPage>
  );
}
