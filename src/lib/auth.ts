import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfflmlpkoutpiscoopnx.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JSf9dHPMpC8L3mlxtYkT9A_jclqOsrm';
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
  let bearer = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  if (!bearer) {
    const cookie = h.get('cookie') ?? '';
    const match = cookie.match(/(?:sb-[^=]+-auth-token|sb-auth-token)=([^;]+)/);
    if (match?.[1]) bearer = decodeURIComponent(match[1]);
  }
  if (!bearer) return null;
  const supabase = getAuth(new Request('http://localhost', { headers: { authorization: `Bearer ${bearer}` } }));
  const { data, error } = await supabase.auth.getUser(bearer);
  if (error || !data.user) return null; const u = data.user as any; u.name = u.user_metadata?.name || u.email?.split("@")[0] || "Usuario"; return { user: u };
}
