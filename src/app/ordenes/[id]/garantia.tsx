'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { abrirGarantia, cerrarGarantia } from '../garantia-actions';

import { button, input } from '@/components/ui';

export function Garantia({ ordenId, enGarantia }: { ordenId: string; enGarantia: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function enviar() {
    setBusy(true);
    setError('');
    const r = enGarantia ? await cerrarGarantia(ordenId, texto) : await abrirGarantia(ordenId, texto);
    setBusy(false);
    if (r.ok) { setTexto(''); router.refresh(); } else setError(r.error);
  }
  return (
    <div className="grid gap-3">
      <label className="text-sm font-medium">{enGarantia ? 'Cómo se resolvió (opcional)' : 'Falla que reclama el cliente'}
        <textarea className={input} maxLength={300} onChange={(e) => { setTexto(e.target.value); }} rows={2} value={texto} />
      </label>
      <button className={button.primary} disabled={busy} onClick={() => { void enviar(); }} type="button">{enGarantia ? 'Cerrar garantía' : 'Abrir garantía'}</button>
      {error && <p className="font-medium text-brand" role="alert">{error}</p>}
    </div>
  );
}
