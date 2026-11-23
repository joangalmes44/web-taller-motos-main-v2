import type { ReactNode } from 'react';

// Íconos técnicos de taller (24×24, trazo currentColor) y el logo de Ride Service. Sin paquetes de íconos.

const wrap = (children: ReactNode) => (
  <svg
    aria-hidden
    className="size-full"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.8}
    viewBox="0 0 24 24"
  >
    {children}
  </svg>
);

const ICONS: Record<string, ReactNode> = {
  // llave inglesa: mantención
  mantencion: wrap(
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  ),
  // chip con patas: diagnóstico electrónico
  diagnostico: wrap(
    <>
      <rect height="10" rx="1" width="10" x="7" y="7" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
      <path d="M10 12h1.5l1-2 1 4 1-2H15" />
    </>,
  ),
  // resorte entre dos placas: suspensión
  suspension: wrap(
    <>
      <path d="M8 3h8M12 3v3M7 9l10-1.5M7 9l10 2M7 13l10-2M7 13l10 2M7 17l10-2M7 17l10 1.5M12 19.5V21M8 21h8" />
    </>,
  ),
  // disco y pinza: frenos
  frenos: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="6.8" r=".6" />
      <circle cx="12" cy="17.2" r=".6" />
      <circle cx="6.8" cy="12" r=".6" />
      <circle cx="17.2" cy="12" r=".6" />
      <path d="M18.5 7.5a9 9 0 0 1 0 9" strokeWidth={3.2} />
    </>,
  ),
  // engranaje: motor y afinamiento
  motor: wrap(
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5" />
    </>,
  ),
  // rueda con rayos: neumáticos y balanceo
  neumaticos: wrap(
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.2" />
      <path d="M12 6.5v4.3M12 13.2v4.3M6.5 12h4.3M13.2 12h4.3" />
    </>,
  ),
  // elevador / puesto
  puesto: wrap(
    <>
      <path d="M3 17h18M5 17v3M19 17v3M6 14h12v3H6zM8 14V9l4-3 4 3v5" />
    </>,
  ),
  // reloj
  reloj: wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  // llave de tubo + destornillador cruzados
  herramientas: wrap(
    <>
      <path d="M4 20 14 10M18 3l3 3-3.5 3.5-3-3zM3 21l2-5 3 3z" />
      <path d="M7 4a3.5 3.5 0 0 0 3 5l7 7a2 2 0 0 0 3-3l-7-7a3.5 3.5 0 0 0-6-2z" />
    </>,
  ),
};

export function ToolIcon({ name }: { name: string }) {
  return ICONS[name] ?? ICONS.herramientas;
}

/** El logo: tuerca hexagonal roja con la rueda de la moto adentro. `compact` esconde el nombre. */
export function Logo({ compact = false, dark = true }: { compact?: boolean; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg aria-hidden className="size-9 shrink-0 sm:size-10" viewBox="0 0 48 48">
        <path d="M24 2 43 13v22L24 46 5 35V13z" fill="#D7263D" stroke="#F4C430" strokeLinejoin="round" strokeWidth="2.5" />
        <circle cx="24" cy="24" r="11" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="24" cy="24" r="3" fill="#F4C430" />
        <path d="M24 13v8M24 27v8M13 24h8M27 24h8" stroke="#fff" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
      {!compact && (
        <span
          className={`flex flex-col font-display font-bold uppercase leading-none tracking-wide ${dark ? 'text-white' : 'text-brand'}`}
        >
          <span className="text-lg sm:text-2xl">Ride Service</span>
          <span className="mt-1 text-[0.6rem] font-medium tracking-[0.28em] text-accent">Taller de motos</span>
        </span>
      )}
    </span>
  );
}
