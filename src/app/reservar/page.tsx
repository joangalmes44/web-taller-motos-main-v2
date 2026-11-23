import { and, count, desc, eq, gte } from '@/db/compat';
import type { Metadata } from 'next';

import { ReservaWizard } from './reserva-wizard';

import { AppPage } from '@/components/ui';
import { motos, reservas, servicioTarifas, servicios } from '@/db/schema';
import { ABONO_PENALIDAD, AUSENCIAS_PARA_ABONO, hoyCL, MESES_AUSENCIAS, sumarDias } from '@/lib/agenda';
import { db } from '@/db';
import { loadPage } from '@/lib/load-page';

export const metadata: Metadata = { title: 'Reservar hora' };

export default async function ReservarPage() {
  const { user, data } = await loadPage((me) => [
    // servicios y tarifas son públicos; lo propio se filtra por la sesión
    db.select().from(servicios).orderBy(servicios.orden),
    db.select().from(servicioTarifas),
    db.select().from(motos).where(eq(motos.userId, me)).orderBy(desc(motos.creadoEn)).limit(20),
    db.select({ n: count() }).from(reservas).where(and(eq(reservas.userId, me), eq(reservas.estado, 'No asistió'), gte(reservas.inicio, sumarDias(hoyCL(), -30 * MESES_AUSENCIAS)))),
  ] as const);
  const [svs, tarifas, mias, aus] = data;
  const penalidad = user && (aus[0]?.n ?? 0) >= AUSENCIAS_PARA_ABONO ? ABONO_PENALIDAD : 0;
  return (
    <AppPage title="Reservá tu hora" description="Contanos qué moto tenés, elegí el servicio y reservá un bloque libre.">
      <ReservaWizard
        hoy={hoyCL()}
        logueado={!!user}
        motos={mias.map((m) => ({ id: m.id, patente: m.patente, marca: m.marca, modelo: m.modelo, cc: m.cc }))}
        penalidad={penalidad}
        servicios={svs.map((s) => ({ id: s.id, nombre: s.nombre, nota: s.soloPuestoEquipado ? 'Se hace en el Puesto 3, el equipado.' : null }))}
        tarifas={tarifas}
      />
    </AppPage>
  );
}
