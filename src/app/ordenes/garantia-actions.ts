'use server';

import { and, eq } from '@/db/compat';
import { revalidatePath } from 'next/cache';

import { db } from '@/db';
import { ordenes, ordenHistorial } from '@/db/schema';
import { DIAS_GARANTIA } from '@/lib/garantia';
import { currentRol } from '@/lib/roles';
import { uuid } from '@/lib/uuid';

type Res = { ok: true } | { ok: false; error: string };

async function permiso() {
  const { session, rol } = await currentRol();
  if (!session) return { error: 'Ingresá a tu cuenta para continuar.' } as const;
  if (rol !== 'recepcion' && rol !== 'administracion') return { error: 'Solo Recepción o Administración gestionan garantías.' } as const;
  return { autor: session.user.name || 'Equipo' } as const;
}

export async function abrirGarantia(ordenId: string, motivo: string): Promise<Res> {
  const p = await permiso();
  if (!('autor' in p)) return { ok: false, error: p.error };
  const texto = motivo.trim().slice(0, 300);
  if (texto.length < 5) return { ok: false, error: 'Contá qué falla reclama el cliente (mínimo 5 letras).' };
  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, ordenId)).limit(1);
  if (!o) return { ok: false, error: 'No encontramos la orden.' };
  if (o.estado !== 'Entregada') return { ok: false, error: 'Solo una orden entregada puede entrar en garantía.' };
  const dias = Math.floor((Date.now() - new Date(o.entregadaEn ?? o.actualizadoEn).getTime()) / 86_400_000);
  if (dias > DIAS_GARANTIA) return { ok: false, error: `La garantía cubre ${DIAS_GARANTIA} días desde la entrega y esta se entregó hace ${dias}.` };
  await db.batch([
    db.update(ordenes).set({ estado: 'Garantía', actualizadoEn: new Date().toISOString() }).where(and(eq(ordenes.id, o.id), eq(ordenes.estado, 'Entregada'))),
    db.insert(ordenHistorial).values({ id: uuid(), ordenId: o.id, estado: 'Garantía', nota: texto, autor: p.autor }),
  ]);
  console.log('garantia abierta', o.id);
  revalidatePath(`/ordenes/${o.id}`);
  revalidatePath('/ordenes');
  revalidatePath('/informes');
  return { ok: true };
}

export async function cerrarGarantia(ordenId: string, nota: string): Promise<Res> {
  const p = await permiso();
  if (!('autor' in p)) return { ok: false, error: p.error };
  const [o] = await db.select().from(ordenes).where(eq(ordenes.id, ordenId)).limit(1);
  if (!o || o.estado !== 'Garantía') return { ok: false, error: 'Esta orden no está en garantía.' };
  await db.batch([
    db.update(ordenes).set({ estado: 'Entregada', actualizadoEn: new Date().toISOString() }).where(and(eq(ordenes.id, o.id), eq(ordenes.estado, 'Garantía'))),
    db.insert(ordenHistorial).values({ id: uuid(), ordenId: o.id, estado: 'Entregada', nota: nota.trim().slice(0, 300) || 'Garantía resuelta sin costo.', autor: p.autor }),
  ]);
  console.log('garantia cerrada', o.id);
  revalidatePath(`/ordenes/${o.id}`);
  revalidatePath('/ordenes');
  revalidatePath('/informes');
  return { ok: true };
}
