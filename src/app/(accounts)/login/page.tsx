import type { Metadata } from 'next';
import { connection } from 'next/server';

import { AuthForm } from '../auth-form';
import { DemoAccesos } from '../demo-accesos';
import { text } from '../text';

import { googleClient } from '@/lib/auth';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { isPreviewSurface } from '@/lib/request-origin';
import { ROL_NOMBRE } from '@/lib/roles';

export const metadata: Metadata = { title: text.signIn.submit };

export default async function LoginPage() {
  await connection(); // read at request time: the Google button follows the project's secrets
  const preview = isPreviewSurface();
  return (
    <AuthForm
      below={
        preview ? (
          <DemoAccesos
            cuentas={DEMO_ACCOUNTS.map((a) => ({ ...a, rolNombre: ROL_NOMBRE[a.rol] }))}
            password={DEMO_PASSWORD}
          />
        ) : undefined
      }
      google={googleClient() !== null}
      mode="sign-in"
      preview={preview}
    />
  );
}
