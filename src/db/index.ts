import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function ensureClient(accessToken?: string): SupabaseClient {
  if (!url || !anonKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

export function getSupabaseServer(accessToken?: string): SupabaseClient { return ensureClient(accessToken); }
export function getSupabaseAdmin(): SupabaseClient {
  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const base = ensureClient();

class SupabaseBuilder implements PromiseLike<any[]> {
  private tableName = '';
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private projection = '*';
  private filters: any[] = [];
  private order: Array<{ field: string; dir: 'asc'|'desc' }> = [];
  private limitValue?: number;
  private joins: any[] = [];
  constructor(private client: SupabaseClient, table?: string) { if (table) this.tableName = table; }
  select(projection?: any) {
    this.mode = 'select';
    this.projection = typeof projection === 'object' ? '*' : (typeof projection === 'string' ? projection : '*');
    this._projection = projection;
    return this;
  }
  private _projection: any;
  from(table: any) { this.tableName = typeof table === 'string' ? table : table?.tableName ?? table?.name; return this; }
  insert(payload: any) { this.mode='insert'; this.payload=payload; return this; }
  values(payload: any) { this.payload=payload; return this; }
  update(payload: any) { this.mode='update'; this.payload=payload; return this; }
  set(payload: any) { this.payload={...this.payload,...payload}; return this; }
  delete() { this.mode='delete'; return this; }
  where(condition: any) { this.filters.push(condition); return this; }
  innerJoin(_table:any,_condition:any) { this.joins.push({table:_table,condition:_condition}); return this; }
  groupBy(..._fields:any[]) { return this; }
  orderBy(...fields:any[]) { for (const f of fields) this.order.push({field:f?.field ?? f?.column ?? f, dir:f?.direction==='asc'?'asc':'desc'}); return this; }
  limit(n:number) { this.limitValue=n; return this; }
  returning(_projection?:any) { return this; }
  onConflictDoNothing() { return this; }
  onConflictDoUpdate(_opts:any) { return this; }

  private apply(query: any) {
    for (const c of this.filters) {
      if (!c) continue;
      if (typeof c === 'string') continue;
      const field = typeof c.field === 'string' ? c.field : c.field?.column;
      if (!field) continue;
      if (c.kind === 'eq' && typeof query.eq === 'function') query = query.eq(field, c.value);
      else if (c.kind === 'ne' && typeof query.neq === 'function') query = query.neq(field, c.value);
      else if (c.kind === 'gte' && typeof query.gte === 'function') query = query.gte(field, c.value);
      else if (c.kind === 'gt' && typeof query.gt === 'function') query = query.gt(field, c.value);
      else if (c.kind === 'lte' && typeof query.lte === 'function') query = query.lte(field, c.value);
      else if (c.kind === 'lt' && typeof query.lt === 'function') query = query.lt(field, c.value);
      else if (c.kind === 'in' && typeof query.in === 'function') query = query.in(field, c.value);
      else if (c.kind === 'notIn' && typeof query.not === 'function') query = query.not('id', 'in', `(${(c.value as any[]).join(',')})`);
      else if (c.kind === 'like' && typeof query.like === 'function') query = query.like(field, String(c.value).replaceAll('%', '*'));
      else if (c.kind === 'and' && c.items) {
        for (const nested of c.items) {
          const b = new SupabaseBuilder(this.client);
          b.filters = [nested];
          query = b.apply(query);
        }
      }
    }
    if (this.mode === 'select') {
      for (const o of this.order) {
        if (o?.field && typeof query.order === 'function') {
          query = query.order(o.field, { ascending: o.dir === 'asc' });
        }
      }
      if (this.limitValue && typeof query.limit === 'function') {
        query = query.limit(this.limitValue);
      }
    }
    return query;
  }

  async execute(): Promise<any[]> {
    let query: any;
    if (this.mode === 'select') {
      query = this.apply(this.client.from(this.tableName).select(this.projection));
    } else if (this.mode === 'insert') {
      query = this.client.from(this.tableName).insert(this.payload).select('*');
    } else if (this.mode === 'update') {
      query = this.apply(this.client.from(this.tableName).update(this.payload)).select('*');
    } else {
      query = this.apply(this.client.from(this.tableName).delete()).select('*');
    }
    const { data, error } = await query;
    if (error) throw error;
    return this.project(data ?? []);
  }
  then<TResult1 = any[], TResult2 = never>(onfulfilled?: ((value:any[])=>TResult1|PromiseLike<TResult1>)|null, onrejected?: ((reason:any)=>TResult2|PromiseLike<TResult2>)|null) {
    return this.execute().then(onfulfilled,onrejected);
  }
}

const db:any = base;
for (const method of ['select','insert','update','delete','from','run','batch']) delete (db as any)[method];
db.select=(projection:any)=>new SupabaseBuilder(base).select(projection);
db.from=(table:any)=>new SupabaseBuilder(base,typeof table==='string'?table:table?.tableName);
db.insert=(payload:any)=>payload && payload.tableName ? new SupabaseBuilder(base,payload.tableName).insert(null) : new SupabaseBuilder(base).insert(payload);
db.update=(payload:any)=>payload && payload.tableName ? new SupabaseBuilder(base,payload.tableName).update({}) : new SupabaseBuilder(base).update(payload);
db.delete=()=>new SupabaseBuilder(base).delete();
db.batch=(items:any[])=>Promise.all(items.map((item:any)=>item?.execute ? item.execute() : item));
db.run=(_sql:any)=>{ throw new Error('SQL Drizzle/SQLite no soportado: migra esta operación a supabase.from(...)'); };

export const supabase: SupabaseClient | null = base;
export { db };

