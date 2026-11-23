'use client';

import { useState } from 'react';

import { button } from '@/components/ui';

export function CompartirAviso({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a className={button.primary} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} rel="noreferrer" target="_blank">Compartir por WhatsApp</a>
      <button
        className={button.secondary}
        onClick={() => {
          void navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => { setOk(false); }, 2500); }, () => { window.prompt('Copiá el texto:', texto); });
        }}
        type="button"
      >
        {ok ? '¡Copiado!' : 'Copiar texto'}
      </button>
    </div>
  );
}
