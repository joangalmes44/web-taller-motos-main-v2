'use client';

import { useRouter } from 'next/navigation';

import { signOut } from '@/lib/auth-client';

// «Salir» del encabezado: se estiliza con `className` como los demás links.
export function SalirButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={() => {
        void signOut().then(() => {
          router.replace('/');
          router.refresh();
        });
      }}
      type="button"
    >
      Salir
    </button>
  );
}
