import { TALLER, cuando } from '@/lib/agenda';

/** Texto listo para compartir por WhatsApp o copiar. */
export function textoReserva(r: { servicio: string; moto: string; inicio: string; puesto: number; estado: string; abono: number }) {
  const base = `${TALLER}: ${r.estado === 'Pendiente' ? 'tu hora quedó reservada, pendiente de abono' : 'tu hora está confirmada'}.\nServicio: ${r.servicio}\nMoto: ${r.moto}\nCuándo: ${cuando(r.inicio)} (Puesto ${String(r.puesto)})`;
  return r.estado === 'Pendiente' ? `${base}\nAbono previo: $${r.abono.toLocaleString('es-CL')}, a pagar en el taller.` : `${base}\nLlegá unos minutos antes: pasados 20 minutos damos la hora por perdida.`;
}
