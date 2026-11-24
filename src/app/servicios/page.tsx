import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

import { AppPage, Badge, Card, button } from '@/components/ui';
import { clp, horas, RANGO_TEXTO, type Rango } from '@/lib/catalogo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Servicios y precios' };

export default async function ServiciosPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [{ data: svsData }, { data: tarifasData }] = await Promise.all([
    supabase.from('servicios').select('*').order('orden', { ascending: true }),
    supabase.from('servicio_tarifas').select('*'),
  ]);

  const svs = svsData ?? [];
  const tarifas = tarifasData ?? [];

  return (
    <AppPage
      title="Servicios y precios"
      description="El precio de mano de obra y el tiempo dependen de la cilindrada de tu moto. Los repuestos van aparte."
      action={<Link className={button.primary} href="/reservar">Reservar hora</Link>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {svs.map((s: any) => (
          <Card
            key={s.id}
            title={s.nombre}
            action={s.solo_puesto_equipado ? <Badge tone="blue">Puesto 3</Badge> : undefined}
          >
            <p className="leading-7 text-zinc-600">{s.descripcion}</p>
            {s.nota && <p className="mt-2 text-sm font-medium text-zinc-700">{s.nota}</p>}
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {(['A', 'B', 'C'] as Rango[]).map((r) => {
                const t = tarifas.find((x: any) => x.servicio_id === s.id && x.rango === r);
                return (
                  <div className="border-2 border-zinc-300 bg-zinc-50 px-1 py-2" key={r}>
                    <dt className="font-display text-xs uppercase tracking-wide text-zinc-600">
                      <span className="mr-1 inline-block bg-brand px-1 text-white">{r}</span>
                      {RANGO_TEXTO[r].replace(' a ', '-').replace(' cc', '')} cc
                    </dt>
                    <dd className="font-display text-xl font-semibold tabular-nums">
                      {t ? clp(t.precio_clp) : '-'}
                    </dd>
                    <dd className="text-xs text-zinc-600">{t ? horas(t.duracion_min) : ''}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>
    </AppPage>
  );
}