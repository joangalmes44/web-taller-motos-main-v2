import { supabase } from '@/lib/supabase';

// "a.b.example" → "b.example": enough to tell another site's frame (a guess the wrong way only costs the new-tab notice)
const siteOf = (host: string) => host.split('.').slice(-2).join('.');

/**
 * loginfix: the app runs inside a frame of another site (another domain framing the published app), where the browser
 * keeps only a partitioned session cookie. A frame of the same site keeps the normal one.
 */
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

/**
 * framesess: server actions and pages inside that frame carry no FRAME_HEADER, so a session they re-issue (changePassword
 * with revokeOtherSessions, a refreshed cookie cache) came back SameSite=Lax and the frame dropped it. This cookie lives
 * only in the frame's partition (never in the app's own tab) and tells src/lib/auth.ts the same thing on every request.
 */
if (crossSiteFrame()) document.cookie = '__Host-tlm_frame=1; Path=/; Secure; SameSite=None; Partitioned';

export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) =>
    supabase.auth.signInWithPassword({ email, password }),
  social: async ({ provider, callbackURL }: { provider: 'google'; callbackURL: string }) =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}${callbackURL}` } }),
};

export const signUp = {
  email: async ({ email, password, name }: { email: string; password: string; name?: string }) =>
    supabase.auth.signUp({ email, password, options: { data: { name: name ?? '' } } }),
};

export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();
export const useSession = () => supabase.auth.onAuthStateChange;

export const updateUser = (attributes: { name?: string }) =>
  supabase.auth.updateUser({ data: { name: attributes.name } });
export const deleteUser = () => supabase.auth.signOut();
export const changePassword = async ({ password }: { password: string }) =>
  supabase.auth.updateUser({ password });

export const emailOtp = {
  sendVerificationOtp: ({ email }: { email: string }) => supabase.auth.resetPasswordForEmail(email),
  verifyEmail: async () => ({ error: null, data: null }),
  requestPasswordReset: ({ email }: { email: string }) => supabase.auth.resetPasswordForEmail(email),
  resetPassword: async ({ password }: { password: string }) => supabase.auth.updateUser({ password }),
};

/**
 * After a sign-in inside a frame: did the browser keep the session? Some browsers (Safari, in-app browsers, strict
 * privacy settings) refuse every cookie in another site's frame; then only a tab of its own signs in.
 */
export async function sessionKept(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
