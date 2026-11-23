import type { ReactNode } from 'react';

// Las piezas de las pantallas de la app (paneles, listas, detalle). Estética de taller: borde grueso grafito, sombra
// dura de cartel, títulos en Oswald. Los colores saturados quedan para estados (Badge) y alertas.

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tech';

export const button = {
  primary: `inline-flex items-center justify-center gap-2 rounded-sm border-2 border-brand bg-brand px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-white shadow-[3px_3px_0_0_var(--color-accent)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--color-accent)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${focus} disabled:pointer-events-none disabled:opacity-50`,
  secondary: `inline-flex items-center justify-center gap-2 rounded-sm border-2 border-brand bg-white px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-brand shadow-[3px_3px_0_0_var(--color-brand)] transition-all hover:-translate-x-px hover:-translate-y-px hover:bg-zinc-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${focus} disabled:pointer-events-none disabled:opacity-50`,
};
export const input =
  'mt-1.5 w-full rounded-sm border-2 border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus:border-brand focus:ring-4 focus:ring-accent/50';

/** Una pantalla de la app: fondo gris claro, fila de título (título, una línea, acción principal) y el contenido. */
export function AppPage(props: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[70dvh] bg-paper">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-brand pb-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 break-words font-display text-3xl font-semibold uppercase leading-none tracking-wide sm:text-4xl">
              <span aria-hidden className="hazard size-5 shrink-0 border-2 border-brand sm:size-6" />
              <span className="min-w-0">{props.title}</span>
            </h1>
            {props.description && <p className="mt-3 max-w-prose text-zinc-600">{props.description}</p>}
          </div>
          {props.action}
        </div>
        <div className="mt-8 grid gap-6">{props.children}</div>
      </main>
    </div>
  );
}

/** Una tarjeta blanca enmarcada; con `title` (y `action` a la derecha) lleva una cabecera tipo etiqueta de taller. */
export function Card(props: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-sm border-2 border-brand bg-white shadow-poster-sm ${props.className ?? ''}`}
    >
      {props.title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand bg-zinc-100 px-4 py-2.5 sm:px-5">
          <h2 className="font-display text-base font-semibold uppercase tracking-wide">{props.title}</h2>
          {props.action}
        </div>
      )}
      <div className="p-4 sm:p-5">{props.children}</div>
    </section>
  );
}

/** Una cifra de panel: poné 2–4 en `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`. */
export function Stat(props: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-sm border-2 border-l-8 border-brand border-l-accent bg-white p-4 shadow-poster-sm">
      <p className="font-display text-sm font-medium uppercase tracking-wide text-zinc-600">{props.label}</p>
      <p className="mt-1 font-display text-5xl font-semibold leading-none tabular-nums">{props.value}</p>
      {props.hint && <p className="mt-2 text-sm text-zinc-600">{props.hint}</p>}
    </div>
  );
}

// Estados de orden y alertas: verde = lista / confirmada / stock OK, amarillo = esperando aprobación / repuesto,
// rojo = crítico, azul = en proceso / diagnóstico, gris = neutro.
const tones = {
  green: { box: 'border-ok bg-ok/15 text-brand', dot: 'bg-ok' },
  amber: { box: 'border-accent bg-accent/40 text-brand', dot: 'bg-accent ring-1 ring-brand/40' },
  red: { box: 'border-signal bg-signal text-white', dot: 'bg-white' },
  blue: { box: 'border-tech bg-tech/15 text-brand', dot: 'bg-tech' },
  gray: { box: 'border-zinc-400 bg-zinc-100 text-zinc-700', dot: 'bg-zinc-400' },
};
/** Una insignia de estado: green = lista/OK, amber = esperando, red = crítico, blue = en proceso, gray = neutro. */
export function Badge(props: { tone?: keyof typeof tones; children: ReactNode }) {
  const t = tones[props.tone ?? 'gray'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs border-2 px-2 py-0.5 font-display text-xs font-semibold uppercase leading-5 tracking-wide ${t.box}`}
    >
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${t.dot}`} />
      {props.children}
    </span>
  );
}

/** Lo que muestra una lista vacía: un título, una línea de ayuda y la acción que la llena. */
export function EmptyState(props: { title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="border-2 border-brand bg-accent p-3 text-brand shadow-poster-sm">
        <svg
          aria-hidden
          className="size-7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <p className="mt-5 font-display text-xl font-semibold uppercase tracking-wide">{props.title}</p>
      {props.text && <p className="mt-1 max-w-sm text-sm text-zinc-600">{props.text}</p>}
      {props.action && <div className="mt-5">{props.action}</div>}
    </div>
  );
}
