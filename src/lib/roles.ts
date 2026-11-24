import { redirect } from 'next/navigation';
import { supabase } from '@/db';
import { currentUser } from './auth';

export { currentUser };

export type Rol = 'cliente' | 'mecanico' | 'recepcion' | 'administracion';

export interface PerfilActual {
  userId: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export async function currentRol(): Promise<PerfilActual | null> {
  const user = await currentUser();
  if (!user) return null;

  let rol: Rol = 'cliente';
  let nombre = user.name || user.email.split('@')[0] || 'Usuario';

  if (supabase) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, nombre')
      .eq('user_id', user.id)
      .maybeSingle();

    if (perfil?.rol) {
      rol = perfil.rol as Rol;
    }
    if (perfil?.nombre) {
      nombre = perfil.nombre;
    }
  }

  return {
    userId: user.id,
    email: user.email,
    nombre,
    rol,
  };
}

export function tieneRol(rolActual: Rol, permitidos: Rol[]): boolean {
  return permitidos.includes(rolActual);
}

export async function requireRol(permitidos: Rol[]): Promise<PerfilActual> {
  const perfil = await currentRol();
  if (!perfil) redirect('/login');
  if (!permitidos.includes(perfil.rol)) redirect('/panel');
  return perfil;
}
