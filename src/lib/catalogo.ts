export type Rango = 'A' | 'B' | 'C';
export const CC_MIN = 125;
export const CC_MAX = 1300;

export function rangoDe(cc: number): Rango | null {
  if (!Number.isFinite(cc) || cc < CC_MIN || cc > CC_MAX) return null;
  return cc <= 400 ? 'A' : cc <= 800 ? 'B' : 'C';
}
export const RANGO_TEXTO: Record<Rango, string> = { A: '125 a 400 cc', B: '401 a 800 cc', C: '801 a 1300 cc' };
export const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');
export const horas = (min: number) => `${(min / 60).toString().replace('.', ',')} h`;
