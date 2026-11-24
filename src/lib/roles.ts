import { redirect } from 'next/navigation';

import { supabase } from '@/db';
import { type Rol } from '@/db/schema';
import { isAdmin } from '@/lib/admin';
import { currentSession } from '@/lib/auth';

export type { Rol };

export const ROL_NOMBRE: Record<Rol, string> = {
  cliente: 'Cliente',
  mecanico: 'Mecánico',
  recepcion: 'Recepción',
  administracion: 'Administración',
};

type Link = { href: string; label: string };

/** Navegación de cada rol. Las pantallas de los pasos siguientes se suman acá. */
export const NAV_POR_ROL: Record<Rol, Link[]> = {
  cliente: [
    { href: '/panel', label: 'Mi panel' },
    { href: '/mis-motos', label: 'Mis motos' },
    { href: '/ordenes', label: 'Mis órdenes' },
    { href: '/reservar', label: 'Reservar hora' },
    { href: '/servicios', label: 'Servicios' },
  ],
  mecanico: [
    { href: '/panel', label: 'Mi panel' },
    { href: '/mecanico', label: 'Mis órdenes' },
    { href: '/inventario', label: 'Repuestos' },
  ],
  recepcion: [
    { href: '/panel', label: 'Panel' },
    { href: '/agenda', label: 'Agenda' },
    { href: '/ordenes', label: 'Órdenes' },
    { href: '/caja', label: 'Caja' },
    { href: '/inventario', label: 'Repuestos' },
    { href: '/compras', label: 'Compras' },
    { href: '/servicios', label: 'Servicios' },
  ],
  administracion: [
    { href: '/panel', label: 'Panel' },
    { href: '/agenda', label: 'Agenda' },
    { href: '/ordenes', label: 'Órdenes' },
    { href: '/caja', label: 'Caja' },
    { href: '/inventario', label: 'Repuestos' },
    { href: '/compras', label: 'Compras' },
    { href: '/servicios', label: 'Servicios' },
    { href: '/proveedores', label: 'Proveedores' },
    { href: '/informes', label: 'Informes' },
  ],
};

/** Rol de la sesión: administración si es una dirección de admin; si no, la fila de `perfiles`; sin fila, cliente. */
export async function currentRol() {
  const session = await currentSession();
  if (!session) return { session: null, rol: 'cliente' as Rol };
  const user = session.user;
  if (isAdmin(user)) return { session, rol: 'administracion' as Rol };
  const { data: perfil } = await supabase!.from('perfiles').select('rol').eq('user_id', user.id).maybeSingle();
  const rol: Rol = (perfil?.rol as Rol) || 'cliente';
  return { session, rol };
}

/** Protege una página: sin sesión va a /login; con un rol que no corresponde, a /panel. */
export async function requireRol(allowed?: Rol[]) {
  const { session, rol } = await currentRol();
  if (!session) redirect('/login');
  if (allowed && !allowed.includes(rol)) redirect('/panel');
  return { user: session.user, rol };
}
