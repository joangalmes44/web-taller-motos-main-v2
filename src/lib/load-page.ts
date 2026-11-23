import { headers } from 'next/headers';
import { currentSession } from '@/lib/auth';

export async function loadPage<T>(queries: (_me: any) => T, options?: { signedIn: true }): Promise<{ user: any; data: T | null }> {
  const session = await currentSession();
  if (options?.signedIn && !session) return { user: null, data: null };
  const items = queries(session?.user?.id ?? null);
  const data = items && typeof items === 'object' && 'then' in items ? await (items as any) : items;
  if (Array.isArray(data)) {
    const resolved = await Promise.all(data.map((item: any) => item?.execute ? item.execute() : item));
    return { user: session?.user ?? null, data: resolved as T };
  }
  return { user: session?.user ?? null, data: data as T };
}
