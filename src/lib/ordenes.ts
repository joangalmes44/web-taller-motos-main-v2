// Reglas de las órdenes de trabajo en un solo lugar: estados, colores, permisos de cambio y recálculo de la entrega.
import { diffMin, hhmm, horarioDe, sumarDias, sumarMin } from '@/lib/agenda';

export const ESTADOS_MECANICO = ['En diagnóstico', 'En reparación', 'Prueba de ruta', 'Lista para retirar'] as const;
export const ESTADOS_STAFF = ['Recibida', ...ESTADOS_MECANICO, 'Anulada'] as const;
export const ESTADOS_CERRADOS = ['Entregada', 'Anulada'] as const;
export const COMBUSTIBLE = ['Reserva', '1/4', '1/2', '3/4', 'Lleno'] as const;
export const ADICIONAL_HORAS = 24;

export const ORDEN_TONO = {
  Recibida: 'gray',
  'En diagnóstico': 'blue',
  'Esperando aprobación': 'amber',
  'Esperando repuesto': 'amber',
  'En reparación': 'blue',
  'Prueba de ruta': 'blue',
  'Lista para retirar': 'green',
  Entregada: 'green',
  Garantía: 'red',
  Anulada: 'gray',
} as const;
export const ADICIONAL_TONO = { Propuesto: 'amber', Aprobado: 'green', Rechazado: 'gray', Vencido: 'gray' } as const;

export const numeroOrden = (n: number) => `OT-${String(n).padStart(4, '0')}`;

/** Fecha y hora estimada de entrega: el fin planificado más el tiempo extra aprobado, respetando el horario del taller. */
export function recalcularEntrega(finPlan: string, extraMin: number): { entrega: string; movida: boolean } {
  if (extraMin <= 0) return { entrega: finPlan, movida: false };
  let dia = finPlan.slice(0, 10);
  let desde = Number(finPlan.slice(11, 13)) * 60 + Number(finPlan.slice(14, 16));
  let resto = extraMin;
  for (let i = 0; i < 40; i++) {
    const h = horarioDe(dia);
    if (h) {
      const ini = Math.max(desde, h.abre);
      const libre = h.cierra - ini;
      if (libre > 0 && resto <= libre) {
        const entrega = `${dia}T${hhmm(ini + resto)}`;
        return { entrega, movida: dia !== finPlan.slice(0, 10) };
      }
      if (libre > 0) resto -= libre;
    }
    dia = sumarDias(dia, 1);
    desde = 0;
  }
  return { entrega: sumarMin(finPlan, extraMin), movida: true };
}

/** Texto de la cuenta regresiva (se calcula en el servidor para el primer pintado y en el cliente para seguirla). */
export function restante(venceEn: string, ahoraMs = Date.now()) {
  const ms = Date.parse(venceEn) - ahoraMs;
  if (ms <= 0) return 'Vencido';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export const duracionPlan = (inicio: string, fin: string) => diffMin(inicio, fin);
