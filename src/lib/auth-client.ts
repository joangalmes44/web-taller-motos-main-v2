import { supabase } from '@/lib/supabase';

const siteOf = (host: string) => host.split('.').slice(-2).join('.');

export function crossSiteFrame(): boolean {
  if (typeof window === 'undefined' || window.top === window.self) return false;
  const ancestors = window.location.ancestorOrigins as DOMStringList | undefined;
  const top = ancestors?.length ? ancestors.item(ancestors.length - 1) : document.referrer;
  try {
    return siteOf(new URL(top ?? '').hostname) !== siteOf(window.location.hostname);
  } catch {
    return true;
  }
}

if (typeof document !== 'undefined' && crossSiteFrame()) {
  document.cookie = '__Host-tlm_frame=1; Path=/; Secure; SameSite=None; Partitioned';
}

function syncCookie(token?: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `sb-auth-token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`;
  } else {
    document.cookie = 'sb-auth-token=; Path=/; Max-Age=0; SameSite=Lax';
  }
}

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    syncCookie(session?.access_token ?? null);
  });
}

export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.data?.session?.access_token) syncCookie(res.data.session.access_token);
    return res;
  },
  social: async ({ provider, callbackURL }: { provider: 'google'; callbackURL: string }) =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}${callbackURL}` } }),
};

export const signUp = {
  email: async ({ email, password, name }: { email: string; password: string; name?: string }) => {
    const res = await supabase.auth.signUp({ email, password, options: { data: { name: name ?? '' } } });
    if (res.data?.session?.access_token) syncCookie(res.data.session.access_token);
    return res;
  },
};

export const signOut = async () => {
  syncCookie(null);
  return supabase.auth.signOut();
};
export const getSession = () => supabase.auth.getSession();
export const useSession = () => supabase.auth.onAuthStateChange;

export const updateUser = (attributes: { name?: string }) =>
  supabase.auth.updateUser({ data: { name: attributes.name } });
export const deleteUser = () => signOut();
export const changePassword = async ({ password }: { password: string }) =>
  supabase.auth.updateUser({ password });

export const emailOtp = {
  sendVerificationOtp: ({ email }: { email: string }) => supabase.auth.resetPasswordForEmail(email),
  verifyEmail: async () => ({ error: null, data: null }),
  requestPasswordReset: ({ email }: { email: string }) => supabase.auth.resetPasswordForEmail(email),
  resetPassword: async ({ password }: { password: string }) => supabase.auth.updateUser({ password }),
};

export async function sessionKept(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
