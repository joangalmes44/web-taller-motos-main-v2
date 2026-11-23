'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a leer la pantalla cada minuto mientras está visible (agenda en vivo). */
export function AutoRefresh({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, segundos * 1000);
    return () => { clearInterval(t); };
  }, [router, segundos]);
  return null;
}
