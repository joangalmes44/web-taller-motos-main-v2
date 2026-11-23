import Link from 'next/link';

import { HORARIOS } from '@/components/horarios';
import { ToolIcon } from '@/components/icons';
import { db } from '@/db';
import { servicioTarifas, servicios } from '@/db/schema';
import { clp, type Rango } from '@/lib/catalogo';

const FOTO = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${String(w)}&q=75`;
const FOTOS = {
  hero: '1578474005126-89909099fed6', // mecánico con casco junto a su moto, en el taller
  puesto3: '1771402629441-95e637743f93', // moto sobre elevador con herramientas
  mecanico: '1636761358757-0a616eb9e17e', // mecánico con juego de tubos trabajando en una moto
  taller: '1604260324056-45f7c778754a', // moto clásica sobre elevador rojo
};

const RANGOS: { r: Rango; cc: string }[] = [
  { r: 'A', cc: '125–400' },
  { r: 'B', cc: '401–800' },
  { r: 'C', cc: '801–1300' },
];

const PASOS = [
  { n: '1', titulo: 'Cargá tu moto', texto: 'Marca, modelo y cilindrada. Con eso sabemos cuánto dura y cuánto sale tu servicio.', estado: ['gray', 'Reserva'] },
  { n: '2', titulo: 'Elegí servicio y bloque libre', texto: 'Mirás la agenda y tomás el horario que te sirve. El precio de mano de obra ya viene según tu cc.', estado: ['gray', 'Reserva'] },
  { n: '3', titulo: 'Recibimos tu moto con checklist', texto: 'Antes de tocar nada, repasamos el estado de tu moto con un checklist de ingreso.', estado: ['blue', 'En proceso'] },
  { n: '4', titulo: 'Aprobá adicionales desde tu celular', texto: 'Si aparece algo más para arreglar, te avisamos y decidís vos. Nada se hace sin tu OK.', estado: ['amber', 'Esperando aprobación'] },
  { n: '5', titulo: 'Retirá', texto: 'Cuando está lista te avisamos y la retirás en horario de taller.', estado: ['green', 'Lista'] },
] as const;

const chip = {
  gray: 'border-zinc-400 text-zinc-200',
  blue: 'border-tech bg-tech/20 text-white',
  amber: 'border-accent bg-accent text-brand',
  green: 'border-ok bg-ok/25 text-white',
};

const PUESTOS = [
  { n: '1', titulo: 'Puesto 1', texto: 'Mantención programada, frenos, motor y neumáticos.', icon: 'mantencion' },
  { n: '2', titulo: 'Puesto 2', texto: 'Mantención programada, frenos, motor y neumáticos.', icon: 'neumaticos' },
] as const;

const h2 = 'font-display text-4xl font-semibold uppercase leading-none tracking-wide sm:text-5xl';
const primaryCta =
  'inline-flex items-center justify-center gap-2 rounded-sm border-2 border-white bg-signal px-7 py-4 font-display text-xl font-semibold uppercase tracking-wide text-white shadow-[5px_5px_0_0_var(--color-accent)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_0_var(--color-accent)] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';

export default async function Home() {
  const [svs, tarifas] = await db.batch([db.select().from(servicios).orderBy(servicios.orden), db.select().from(servicioTarifas)]);

  return (
    <main>
      {/* ───────── Hero tipo póster ───────── */}
      <section className="relative isolate overflow-hidden bg-brand text-white">
        <div className="relative aspect-[16/10] sm:aspect-[16/8] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[46%]">
          <img
            alt="Mecánico en su taller junto a una moto deportiva, con el casco en la mano"
            className="size-full object-cover object-[30%_50%]"
            fetchPriority="high"
            src={FOTO(FOTOS.hero, 1600)}
          />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-brand via-brand/10 to-transparent lg:bg-linear-to-r lg:via-brand/10 lg:to-transparent" />
          <div
            aria-hidden
            className="absolute right-4 top-4 -rotate-6 border-4 border-accent bg-brand/90 px-3 py-2 text-center font-display uppercase leading-none text-accent sm:right-8 sm:top-8 lg:bottom-10 lg:right-10 lg:top-auto"
          >
            <span className="block text-xs tracking-[0.25em]">Aprobás</span>
            <span className="block text-2xl font-bold tracking-wide sm:text-3xl">sin sorpresas</span>
            <span className="mt-1 block text-xs tracking-[0.25em]">desde tu celular</span>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 lg:py-24">
          <div className="lg:w-[58%]">
            <p className="inline-flex items-center gap-3 font-display text-sm uppercase tracking-[0.25em] text-accent">
              <span aria-hidden className="hazard h-3 w-10 border border-brand" />
              Taller de motos · 125 a 1300 cc
            </p>
            <h1 className="mt-5 font-display text-[3.4rem] font-bold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-[6.5rem]">
              Tu moto,
              <br />
              lista para <span className="text-accent">rodar.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
              Reservá tu hora según la cilindrada de tu moto, seguí tu orden desde el celular y retirala cuando esté lista.
              Directo, de motociclista a motociclista.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-5">
              <Link className={primaryCta} href="/reservar">
                Reservar hora
                <svg aria-hidden className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link className="font-display text-lg uppercase tracking-wide text-white underline decoration-accent decoration-4 underline-offset-8 transition-colors hover:text-accent" href="/servicios">
                Ver servicios y precios
              </Link>
            </div>
            <p className="mt-8 text-sm text-zinc-300">
              <span className="font-display uppercase tracking-wide text-white">Abrimos:</span> Lun–Vie 11:00 a 20:00 hs · Sáb 11:00 a 16:00 hs
            </p>
          </div>
        </div>
      </section>

      {/* ───────── Franja de rubros ───────── */}
      <div aria-hidden className="overflow-hidden border-y-4 border-brand bg-accent py-3 text-brand">
        <div className="flex w-max gap-6 whitespace-nowrap font-display text-lg font-semibold uppercase tracking-[0.15em] sm:mx-auto sm:text-xl">
          {['Mantención', 'Frenos', 'Suspensión y geometría', 'Diagnóstico electrónico', 'Motor', 'Neumáticos'].map((t) => (
            <span className="flex items-center gap-6" key={t}>
              {t}
              <span className="size-2.5 rotate-45 bg-brand" />
            </span>
          ))}
        </div>
      </div>

      {/* ───────── Servicios ───────── */}
      <section className="bg-paper py-16 sm:py-24" id="servicios">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className={h2}>Elegí tu servicio</h2>
              <p className="mt-4 text-lg leading-8 text-zinc-600">
                El precio de la mano de obra depende de la cilindrada de tu moto. Los repuestos van aparte y te los mostramos antes de cambiar nada.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-sm border-2 border-brand bg-white px-5 py-3 font-display text-base font-semibold uppercase tracking-wide shadow-poster-sm transition-all hover:-translate-x-px hover:-translate-y-px"
              href="/servicios"
            >
              Ver todo el detalle
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {svs.map((s) => {
              const t = RANGOS.map(({ r }) => tarifas.find((x) => x.servicioId === s.id && x.rango === r));
              const precios = t.flatMap((x) => (x ? [x.precioClp] : []));
              const desde = precios.length ? Math.min(...precios) : null;
              return (
                <article className="flex flex-col border-2 border-brand bg-white shadow-poster" key={s.id}>
                  <div className="flex items-start justify-between gap-3 p-5 pb-0">
                    <div className="size-14 border-2 border-brand bg-brand p-3 text-accent">
                      <ToolIcon name={s.id} />
                    </div>
                    {s.soloPuestoEquipado && (
                      <span className="inline-flex items-center gap-1.5 rounded-xs border-2 border-tech bg-tech/15 px-2 py-0.5 font-display text-xs font-semibold uppercase leading-5 tracking-wide">
                        <span aria-hidden className="size-2 rounded-full bg-tech" />
                        Puesto 3
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-2xl font-semibold uppercase leading-tight tracking-wide">{s.nombre}</h3>
                    <p className="mt-2 leading-7 text-zinc-600">{s.descripcion}</p>
                    {s.nota && <p className="mt-2 text-sm font-medium text-zinc-700">{s.nota}</p>}
                  </div>
                  <div className="mt-auto border-t-2 border-brand bg-zinc-50 p-5">
                    <p className="flex items-baseline gap-2">
                      <span className="font-display text-sm uppercase tracking-[0.2em] text-zinc-600">Desde</span>
                      <span className="font-display text-5xl font-semibold leading-none tabular-nums">{desde !== null ? clp(desde) : '—'}</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">Mano de obra, en CLP</p>
                    <dl className="mt-4 grid grid-cols-3 gap-2">
                      {RANGOS.map(({ r, cc }, i) => (
                        <div className="border-2 border-zinc-300 bg-white px-1.5 py-1.5 text-center" key={r}>
                          <dt className="font-display text-xs uppercase tracking-wide text-zinc-600">
                            <span className="mr-1 inline-block bg-brand px-1 text-white">{r}</span>
                            {cc}
                          </dt>
                          <dd className="font-display text-base font-semibold tabular-nums">{clp(t[i]?.precioClp ?? 0).replace(/^\$0$/, '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-zinc-600">Rangos de cilindrada: A de 125 a 400 cc · B de 401 a 800 cc · C de 801 a 1300 cc.</p>
        </div>
      </section>

      {/* ───────── Cómo funciona ───────── */}
      <section className="bg-brand py-16 text-white sm:py-24" id="como-funciona">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className={h2}>
            Cómo <span className="text-accent">funciona</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
            Cinco pasos, de tu casa al taller y de vuelta a la ruta. En cada uno sabés en qué estado está tu orden.
          </p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PASOS.map((p) => (
              <li className="flex flex-col border-2 border-zinc-600 bg-zinc-800 p-5" key={p.n}>
                <span className="font-display text-7xl font-bold leading-none text-accent">{p.n}</span>
                <h3 className="mt-3 font-display text-xl font-semibold uppercase leading-tight tracking-wide">{p.titulo}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-zinc-300">{p.texto}</p>
                <span
                  className={`mt-5 inline-flex w-fit items-center gap-1.5 rounded-xs border-2 px-2 py-0.5 font-display text-xs font-semibold uppercase leading-5 tracking-wide ${chip[p.estado[0]]}`}
                >
                  {p.estado[1]}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link className={primaryCta} href="/reservar">
              Reservar hora
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Los 3 puestos ───────── */}
      <section className="bg-cream py-16 sm:py-24" id="puestos">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className={h2}>Los 3 puestos del taller</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
            Cada moto va al puesto que corresponde. Para suspensión, geometría y diagnóstico tenemos uno equipado.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            <figure className="relative min-h-72 overflow-hidden border-2 border-brand shadow-poster lg:col-span-2 lg:min-h-0">
              <img
                alt="Moto sobre un elevador en el taller, con las herramientas a mano"
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
                src={FOTO(FOTOS.puesto3, 800)}
              />
              <figcaption className="absolute bottom-0 left-0 border-r-2 border-t-2 border-brand bg-accent px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                Puesto 3 · equipado
              </figcaption>
            </figure>
            <div className="grid gap-4 lg:col-span-3">
              <article className="relative border-2 border-accent bg-brand p-6 text-white shadow-poster">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="font-display text-7xl font-bold leading-none text-accent">3</span>
                    <h3 className="font-display text-3xl font-semibold uppercase leading-none tracking-wide">Puesto 3</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xs border-2 border-tech bg-tech/20 px-2 py-0.5 font-display text-xs font-semibold uppercase leading-5 tracking-wide">
                    <span aria-hidden className="size-2 rounded-full bg-tech" />
                    Diagnóstico
                  </span>
                </div>
                <p className="mt-4 max-w-lg leading-7 text-zinc-300">
                  El puesto equipado para suspensión, geometría y diagnóstico electrónico. Por eso esos servicios se agendan solo acá.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2 font-display text-sm uppercase tracking-wide">
                  {['Suspensión', 'Geometría', 'Diagnóstico electrónico'].map((x) => (
                    <li className="border-2 border-zinc-500 px-2.5 py-1" key={x}>
                      {x}
                    </li>
                  ))}
                </ul>
              </article>
              {PUESTOS.map((p) => (
                <article className="flex items-center gap-4 border-2 border-brand bg-white p-5 shadow-poster-sm sm:gap-6" key={p.n}>
                  <span className="font-display text-6xl font-bold leading-none">{p.n}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-2xl font-semibold uppercase leading-none tracking-wide">{p.titulo}</h3>
                    <p className="mt-2 leading-6 text-zinc-600">{p.texto}</p>
                  </div>
                  <div className="hidden size-12 shrink-0 border-2 border-brand p-2.5 sm:block">
                    <ToolIcon name={p.icon} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Horarios ───────── */}
      <section className="bg-paper py-16 sm:py-24" id="horarios">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 px-4 sm:px-6 lg:grid-cols-2">
          <div className="flex flex-col border-4 border-brand bg-white shadow-poster">
            <div className="hazard h-3" aria-hidden />
            <div className="flex-1 p-6 sm:p-8">
              <h2 className={h2}>Horarios</h2>
              <p className="mt-3 text-zinc-600">Las horas se reservan dentro de este horario, en bloques libres de la agenda.</p>
              <ul className="mt-6 divide-y-2 divide-brand border-y-2 border-brand">
                {HORARIOS.map((h) => (
                  <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4" key={h.dia}>
                    <span className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-3xl">{h.dia}</span>
                    {h.abierto ? (
                      <span className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">
                        {h.desde} <span className="text-zinc-500">a</span> {h.hasta} <span className="text-base text-zinc-600">hs</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xs border-2 border-signal bg-signal px-3 py-1 font-display text-lg font-semibold uppercase tracking-wide text-white">
                        Cerrado
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <figure className="relative min-h-72 overflow-hidden border-2 border-brand shadow-poster lg:min-h-0">
            <img
              alt="Mecánico arrodillado trabajando en una moto con un juego de llaves de tubo"
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              src={FOTO(FOTOS.mecanico, 800)}
            />
            <figcaption className="absolute bottom-4 left-4 right-4 border-2 border-brand bg-white p-4 sm:right-auto sm:max-w-xs">
              <p className="font-display text-xl font-semibold uppercase leading-tight tracking-wide">Tu moto, en manos que saben</p>
              <p className="mt-1 text-sm text-zinc-600">Trabajamos con checklist de ingreso y te avisamos antes de cualquier adicional.</p>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ───────── Cierre ───────── */}
      <section className="bg-signal text-white">
        <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.2fr_0.8fr]">
          <div className="px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Que tu moto no espere a la próxima salida.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/90">
              Elegí servicio, tomá tu bloque libre y listo. En un minuto tenés tu hora.
            </p>
            <Link
              className="mt-8 inline-flex items-center justify-center rounded-sm border-2 border-brand bg-accent px-7 py-4 font-display text-xl font-semibold uppercase tracking-wide text-brand shadow-[5px_5px_0_0_var(--color-brand)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_0_var(--color-brand)] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              href="/reservar"
            >
              Reservar hora
            </Link>
          </div>
          <div className="relative hidden min-h-64 lg:block">
            <img
              alt="Moto clásica sobre un elevador rojo dentro del taller"
              className="absolute inset-0 size-full object-cover grayscale"
              loading="lazy"
              src={FOTO(FOTOS.taller, 800)}
            />
            <div aria-hidden className="absolute inset-0 bg-signal/40 mix-blend-multiply" />
          </div>
        </div>
      </section>
    </main>
  );
}
