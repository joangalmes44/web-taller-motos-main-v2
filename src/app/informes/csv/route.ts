import { recibosDelMes, rangoMes } from '@/lib/informe';
import { currentRol } from '@/lib/roles';
import { ahoraCL } from '@/lib/agenda';

const cel = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const { session, rol } = await currentRol();
  if (!session) return new Response('Ingresá a tu cuenta.', { status: 401 });
  if (rol !== 'administracion') return new Response('Solo Administración descarga informes.', { status: 403 });
  const q = new URL(req.url).searchParams.get('mes') ?? '';
  const mes = /^20\d\d-(0[1-9]|1[0-2])$/.test(q) ? q : ahoraCL().slice(0, 7);
  const { desde, hasta } = rangoMes(mes);
  const filas = await recibosDelMes(desde, hasta);
  const cab = ['Recibo', 'Fecha (Chile)', 'Orden', 'Mecánico', 'Comisión %', 'Mano de obra', 'Repuestos', 'Bodegaje', 'Cobrado', 'Medio de pago', 'Con garantía', 'Comisión a pagar'];
  const lineas = filas.map((f) => [
    f.numero, ahoraCL(new Date(f.fecha)).replace('T', ' '), f.orden, f.mecanico ?? 'Sin asignar', f.pct ?? 0, f.mano, f.repuestos, f.bodegaje, f.cobrado, f.medio, f.garantia ? 'Sí' : 'No',
    f.garantia ? 0 : Math.round((f.mano * (f.pct ?? 0)) / 100),
  ].map(cel).join(';'));
  console.log('csv informe', mes, filas.length);
  return new Response('﻿' + [cab.map(cel).join(';'), ...lineas].join('\r\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="ride-service-${mes}.csv"` },
  });
}
