import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan las variables públicas de Supabase');
  return { url, key };
}

export function getAuth(req: Request) {
  const { url, key } = config();
  const authorization = req.headers.get('authorization');
  return createClient(url, key, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function googleClient() {
  const enabled = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH === 'true';
  return enabled ? { provider: 'google' } : null;
}

export async function currentSession() {
  const h = await headers();
  const authHeader = h.get('authorization');
  const bearer = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  if (!bearer) {
    const cookie = h.get('cookie') ?? '';
    const match = cookie.match(/(?:sb-[^=]+-auth-token|sb-auth-token)=([^;]+)/);
    if (!match) return null;
  }
  if (!bearer) return null;
  const supabase = getAuth(new Request('http://localhost', { headers: h }));
  const { data, error } = await supabase.auth.getUser(bearer);
  return error ? null : { user: data.user };
}
