// Reglas de la agenda en un solo lugar. Las horas son locales de Chile, como texto "AAAA-MM-DDTHH:mm".
import { rangoDe } from '@/lib/catalogo';

export const TZ = 'America/Santiago';
export const ACTIVAS = ['Pendiente', 'Confirmada', 'En taller'] as const;
export const TOLERANCIA_MIN = 20;
export const CANCELAR_HORAS = 12;
export const ABONO_PENALIDAD = 15000;
export const AUSENCIAS_PARA_ABONO = 3;
export const MESES_AUSENCIAS = 6;
export const TALLER = 'Ride Service';

export const pad = (n: number) => String(n).padStart(2, '0');

/** Hora actual en Chile como "AAAA-MM-DDTHH:mm". */
export function ahoraCL(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const hoyCL = () => ahoraCL().slice(0, 10);

const asUtc = (l: string) => Date.parse(`${l}:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 16);
export const sumarMin = (l: string, min: number) => fromUtc(asUtc(l) + min * 60000);
export const diffMin = (a: string, b: string) => Math.round((asUtc(b) - asUtc(a)) / 60000);
export const sumarDias = (fecha: string, dias: number) => sumarMin(`${fecha}T12:00`, dias * 1440).slice(0, 10);
export const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** Horario del día: minutos desde las 00:00 de apertura y cierre, o null si el taller está cerrado. */
export function horarioDe(fecha: string): { abre: number; cierra: number } | null {
  const d = diaSemana(fecha);
  if (d === 0) return null;
  return { abre: 11 * 60, cierra: d === 6 ? 16 * 60 : 20 * 60 };
}
export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (l: string) => {
  const f = l.slice(0, 10);
  return `${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
};
export const cuando = (l: string) => `${fechaLarga(l)} a las ${l.slice(11, 16)}`;

/** Convierte hora local de Chile a instante UTC (para el .ics). */
export function localAUtc(l: string): Date {
  const guess = asUtc(l);
  const off = (ms: number) => {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT-3';
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(s);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  };
  const o = off(guess - off(guess) * 60000);
  return new Date(guess - o * 60000);
}

export type Ocupada = { puestoId: string; inicio: string; fin: string };
export type PuestoInfo = { id: string; numero: number; equipado: boolean };

/** Bloques libres de un día para un servicio de `dur` minutos. `ocupadas` = reservas activas del día. */
export function bloquesLibres(args: { fecha: string; dur: number; soloEquipado: boolean; puestos: PuestoInfo[]; mecanicos: number; ocupadas: Ocupada[]; ahora?: string }) {
  const h = horarioDe(args.fecha);
  if (!h) return [] as { hora: string; puestoId: string }[];
  const ahora = args.ahora ?? ahoraCL();
  const out: { hora: string; puestoId: string }[] = [];
  const cand = args.puestos.filter((p) => !args.soloEquipado || p.equipado).sort((a, b) => Number(a.equipado) - Number(b.equipado) || a.numero - b.numero);
  for (let m = h.abre; m + args.dur <= h.cierra; m += 30) {
    const ini = `${args.fecha}T${hhmm(m)}`;
    if (ini <= ahora) continue;
    const fin = sumarMin(ini, args.dur);
    const sol = args.ocupadas.filter((o) => o.inicio < fin && o.fin > ini);
    const puesto = cand.find((p) => !sol.some((o) => o.puestoId === p.id));
    if (!puesto) continue;
    const instantes = [ini, ...sol.map((o) => o.inicio).filter((t) => t > ini)];
    if (instantes.some((t) => sol.filter((o) => o.inicio <= t && o.fin > t).length >= args.mecanicos)) continue;
    out.push({ hora: hhmm(m), puestoId: puesto.id });
  }
  return out;
}

/** Cuántos puestos compatibles quedan libres para un bloque exacto, en orden de preferencia (para reintentar si otro gana el bloque). */
export function puestosPara(args: { inicio: string; dur: number; soloEquipado: boolean; puestos: PuestoInfo[]; ocupadas: Ocupada[] }) {
  const fin = sumarMin(args.inicio, args.dur);
  return args.puestos
    .filter((p) => (!args.soloEquipado || p.equipado) && !args.ocupadas.some((o) => o.puestoId === p.id && o.inicio < fin && o.fin > args.inicio))
    .sort((a, b) => Number(a.equipado) - Number(b.equipado) || a.numero - b.numero);
}

export const rangoDeCc = rangoDe;

export const ESTADO_TONO = { Pendiente: 'amber', Confirmada: 'green', 'En taller': 'blue', 'No asistió': 'red', Cancelada: 'gray', Reprogramada: 'gray' } as const;
