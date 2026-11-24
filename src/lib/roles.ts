import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { type Rol } from '@/db/schema';
import { isAdmin } from '@/lib/admin';
import { currentSession, getAuth } from '@/lib/auth';

export type { Rol };

export const ROL_NOMBRE: Record<Rol, string> = {
  cliente: 'Cliente',
  mecanico: 'Mecánico',
  recepcion: 'Recepción',
  administracion: 'Administración',
};

type Link = { href: string; label: string };

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

export async function currentRol() {
  const session = await currentSession();
  if (!session) return { session: null, rol: 'cliente' as Rol };
  const user = session.user;
  if (isAdmin(user)) return { session, rol: 'administracion' as Rol };

  const c = await cookies();
  const token = c.get('sb-auth-token')?.value;
  const client = getAuth(
    new Request('http://localhost', {
      headers: token ? { authorization: `Bearer ${decodeURIComponent(token)}` } : undefined,
    })
  );

  const { data: perfil, error } = await client
    .from('perfiles')
    .select('rol')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[currentRol perfiles error]', error.message);
  }

  const rol: Rol = (perfil?.rol as Rol) || 'cliente';
  return { session, rol };
}

export async function requireRol(allowed?: Rol[]) {
  const { session, rol } = await currentRol();
  if (!session) redirect('/login');
  if (allowed && !allowed.includes(rol)) redirect('/panel');
  return { user: session.user, rol };
}
