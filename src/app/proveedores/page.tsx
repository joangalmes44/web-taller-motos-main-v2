import type { Metadata } from 'next';

import { AppPage, Card } from '@/components/ui';
import { db } from '@/db';
import { proveedores } from '@/db/schema';
import { requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Proveedores' };

export default async function ProveedoresPage() {
  await requireRol(['recepcion', 'administracion']);
  const lista = await db.select().from(proveedores).orderBy(proveedores.nombre).limit(50);
  return (
    <AppPage title="Proveedores" description="Con quién compramos y cuánto tardan en entregar.">
      <div className="grid gap-4 md:grid-cols-3">
        {lista.map((p) => (
          <Card key={p.id} title={p.nombre}>
            <p className="text-zinc-600">{p.rubro}</p>
            <p className="mt-3 font-display text-5xl font-semibold leading-none tabular-nums">{p.plazoDias} <span className="font-sans text-sm font-normal text-zinc-600">días de entrega</span></p>
            <p className="mt-3 break-words text-sm text-zinc-600">{p.contacto} · {p.telefono}</p>
          </Card>
        ))}
      </div>
    </AppPage>
  );
}
