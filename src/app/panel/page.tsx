import type { Metadata } from 'next';
import Link from 'next/link';

import { AppPage, Badge, Card, button } from '@/components/ui';
import { NAV_POR_ROL, ROL_NOMBRE, requireRol } from '@/lib/roles';

export const metadata: Metadata = { title: 'Mi panel' };

const TEXTO = {
  cliente: 'Desde acá ves tus motos, tu kilometraje y tus reservas. Reservá tu hora cuando quieras.',
  mecanico: 'Tus órdenes asignadas, el cambio rápido de estado y la propuesta de trabajos adicionales. También podés consultar el stock sin costos.',
  recepcion: 'Manejá la agenda del día, recibí motos con su checklist, abrí órdenes y asigná mecánicos. También podés consultar repuestos.',
  administracion: 'Tenés acceso a todo el sistema: agenda, órdenes, repuestos y proveedores. Caja y liquidaciones llegan en los próximos pasos.',
} as const;

export default async function PanelPage() {
  const { user, rol } = await requireRol();
  const links = NAV_POR_ROL[rol].filter((l) => l.href !== '/panel');
  return (
    <AppPage title={`Hola, ${user.name.split(' ')[0] || 'motero'}`} description={TEXTO[rol]} action={<Badge tone="gray">{ROL_NOMBRE[rol]}</Badge>}>
      <Card title="Tus accesos">
        <div className="flex flex-wrap gap-3">
          {links.map((l) => (
            <Link className={button.secondary} href={l.href} key={l.href}>{l.label}</Link>
          ))}
        </div>
      </Card>
    </AppPage>
  );
}
