'use client';

import { button } from '@/components/ui';

export function Imprimir() {
  return <button type="button" className={`${button.secondary} print:hidden`} onClick={() => window.print()}>Imprimir</button>;
}
