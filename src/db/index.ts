import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfflmlpkoutpiscoopnx.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JSf9dHPMpC8L3mlxtYkT9A_jclqOsrm';

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

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function mapRow(row: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v;
    out[toCamel(k)] = v;
  }
  return out;
}

function getCol(row: Record<string, any> | null | undefined, col: string): any {
  if (!row || !col) return undefined;
  return row[col] !== undefined ? row[col] : row[toCamel(col)];
}

type JoinSpec = { table: string; condition: any; left: boolean };
type JoinedRow = Record<string, Record<string, any> | null>;

class SupabaseBuilder implements PromiseLike<any[]> {
  private tableName = '';
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private projection = '*';
  private _projection: any;
  private filters: any[] = [];
  private order: Array<{ field: string; dir: 'asc' | 'desc'; raw?: any }> = [];
  private limitValue?: number;
  private joins: JoinSpec[] = [];
  private groupFields: any[] = [];

  constructor(private client: SupabaseClient, table?: string) {
    if (table) this.tableName = table;
  }

  select(projection?: any) {
    this.mode = 'select';
    this.projection = '*';
    this._projection = projection;
    return this;
  }

  from(table: any) {
    this.tableName = typeof table === 'string' ? table : table?.tableName ?? table?.name ?? '';
    return this;
  }

  insert(payload: any) { this.mode = 'insert'; this.payload = payload; return this; }
  values(payload: any) { this.payload = payload; return this; }
  update(payload: any) { this.mode = 'update'; this.payload = payload; return this; }
  set(payload: any) { this.payload = { ...this.payload, ...payload }; return this; }
  delete() { this.mode = 'delete'; return this; }
  where(condition: any) { if (condition) this.filters.push(condition); return this; }

  innerJoin(table: any, condition: any) {
    const tName = typeof table === 'string' ? table : table?.tableName ?? table?.name ?? '';
    this.joins.push({ table: tName, condition, left: false });
    return this;
  }

  leftJoin(table: any, condition: any) {
    const tName = typeof table === 'string' ? table : table?.tableName ?? table?.name ?? '';
    this.joins.push({ table: tName, condition, left: true });
    return this;
  }

  groupBy(...fields: any[]) {
    this.groupFields.push(...fields);
    return this;
  }

  orderBy(...fields: any[]) {
    for (const f of fields) {
      if (!f) continue;
      if (typeof f === 'string') {
        this.order.push({ field: f, dir: 'asc' });
      } else if (f.kind === 'raw') {
        const str = (f.strings ?? []).join('').toLowerCase();
        this.order.push({ field: '', dir: str.includes('desc') ? 'desc' : 'asc', raw: f });
      } else {
        const col = typeof f.field === 'string' ? f.field : (f.field?.column ?? f.column ?? '');
        this.order.push({ field: col, dir: f.direction === 'desc' ? 'desc' : 'asc' });
      }
    }
    return this;
  }

  limit(n: number) { this.limitValue = n; return this; }
  returning(_projection?: any) { return this; }
  onConflictDoNothing() { return this; }
  onConflictDoUpdate(_opts: any) { return this; }

  private applyBaseFilters(query: any) {
    for (const c of this.filters) {
      if (!c || typeof c === 'string') continue;
      if (c.kind === 'and' && Array.isArray(c.items)) {
        const b = new SupabaseBuilder(this.client, this.tableName);
        b.filters = c.items;
        query = b.applyBaseFilters(query);
        continue;
      }
      const field = typeof c.field === 'string' ? c.field : c.field?.column;
      const fieldTable = typeof c.field === 'object' ? c.field?.table : undefined;
      if (!field || (fieldTable && fieldTable !== this.tableName)) continue;

      if (c.kind === 'eq' && typeof query.eq === 'function') query = query.eq(field, c.value);
      else if (c.kind === 'ne' && typeof query.neq === 'function') query = query.neq(field, c.value);
      else if (c.kind === 'gte' && typeof query.gte === 'function') query = query.gte(field, c.value);
      else if (c.kind === 'gt' && typeof query.gt === 'function') query = query.gt(field, c.value);
      else if (c.kind === 'lte' && typeof query.lte === 'function') query = query.lte(field, c.value);
      else if (c.kind === 'lt' && typeof query.lt === 'function') query = query.lt(field, c.value);
      else if (c.kind === 'in' && typeof query.in === 'function') {
        if (Array.isArray(c.value) && c.value.length > 0) query = query.in(field, c.value);
      } else if (c.kind === 'notIn' && typeof query.not === 'function') {
        if (Array.isArray(c.value) && c.value.length > 0) query = query.not(field, 'in', `(${c.value.join(',')})`);
      } else if (c.kind === 'like' && typeof query.like === 'function') {
        query = query.like(field, String(c.value).replaceAll('%', '*'));
      }
    }

    if (this.mode === 'select' && this.joins.length === 0 && this.groupFields.length === 0) {
      for (const o of this.order) {
        if (o.field && typeof query.order === 'function') {
          query = query.order(o.field, { ascending: o.dir === 'asc' });
        }
      }
      if (this.limitValue && typeof query.limit === 'function') {
        query = query.limit(this.limitValue);
      }
    }
    return query;
  }

  private evalCondition(jr: JoinedRow, c: any): boolean {
    if (!c) return true;
    if (c.kind === 'and' && Array.isArray(c.items)) {
      return c.items.every((item: any) => this.evalCondition(jr, item));
    }
    if (c.kind === 'or' && Array.isArray(c.items)) {
      return c.items.some((item: any) => this.evalCondition(jr, item));
    }
    if (c.kind === 'raw') {
      const txt = (c.strings ?? []).join(' ');
      const vals = c.values ?? [];
      if (txt.includes('<>') && vals[0]?.table && vals[0]?.column) {
        const actual = getCol(jr[vals[0].table], vals[0].column);
        const m = txt.match(/<>\s*'([^']*)'/);
        if (m) return actual !== m[1];
      }
      return true;
    }

    const col = typeof c.field === 'string' ? c.field : c.field?.column;
    if (!col) return true;
    let val: any;
    if (c.field?.table && jr[c.field.table] !== undefined) {
      val = getCol(jr[c.field.table], col);
    } else {
      for (const tbl of Object.values(jr)) {
        const candidate = getCol(tbl, col);
        if (candidate !== undefined) { val = candidate; break; }
      }
    }

    if (c.kind === 'eq') return val === c.value;
    if (c.kind === 'ne') return val !== c.value;
    if (c.kind === 'gte') return val != null && val >= c.value;
    if (c.kind === 'gt') return val != null && val > c.value;
    if (c.kind === 'lte') return val != null && val <= c.value;
    if (c.kind === 'lt') return val != null && val < c.value;
    if (c.kind === 'in') return Array.isArray(c.value) && c.value.includes(val);
    if (c.kind === 'notIn') return !Array.isArray(c.value) || !c.value.includes(val);
    if (c.kind === 'like') {
      const pattern = String(c.value).replaceAll('%', '');
      return String(val ?? '').includes(pattern);
    }
    return true;
  }

  private async fetchTable(activeClient: SupabaseClient, table: string): Promise<Record<string, any>[]> {
    const target = table === 'users' ? 'perfiles' : table;
    const { data, error } = await activeClient.from(target).select('*');
    if (error) {
      console.error('[SupabaseBuilder join error]', target, error.message);
      return [];
    }
    return (data ?? []).map((r: any) => {
      if (table === 'users') {
        return mapRow({ ...r, id: r.user_id ?? r.id, name: r.nombre ?? r.name ?? 'Usuario', email: r.email ?? '' })!;
      }
      return mapRow(r)!;
    });
  }

  private extractJoinKeys(join: JoinSpec): { joinCol: string; otherTable?: string; otherCol: string } | null {
    const cond = join.condition;
    if (!cond) return null;
    if (cond.kind === 'eq') {
      const leftCol = typeof cond.field === 'string' ? cond.field : cond.field?.column;
      const rightVal = cond.value;
      if (rightVal && typeof rightVal === 'object' && rightVal.column) {
        if (rightVal.table === join.table) {
          return { joinCol: rightVal.column, otherTable: cond.field?.table, otherCol: leftCol };
        }
        return { joinCol: leftCol, otherTable: rightVal.table, otherCol: rightVal.column };
      }
    }
    if (cond.kind === 'raw' && Array.isArray(cond.values) && cond.values.length >= 2) {
      const [a, b] = cond.values;
      if (a?.table === join.table && b?.column) {
        return { joinCol: a.column, otherTable: b.table, otherCol: b.column };
      }
      if (b?.table === join.table && a?.column) {
        return { joinCol: b.column, otherTable: a.table, otherCol: a.column };
      }
    }
    return null;
  }

  private evalSqlExpr(spec: any, group: JoinedRow[]): number {
    if (!spec) return 0;
    if (spec.kind === 'count') {
      const seen = new Set<any>();
      let count = 0;
      for (const jr of group) {
        const baseId = getCol(jr[this.tableName], 'id');
        if (baseId !== undefined) {
          if (!seen.has(baseId)) { seen.add(baseId); count++; }
        } else {
          count++;
        }
      }
      return count;
    }

    const rawText = (spec.strings ?? []).join(' ').toLowerCase();
    const vals: any[] = spec.values ?? [];

    // Stock movements in /inventario
    if (rawText.includes('ingreso') && rawText.includes('salida')) {
      let sum = 0;
      for (const jr of group) {
        const mov = jr['movimientos_stock'];
        if (!mov) continue;
        if (['ingreso', 'salida', 'ajuste'].includes(mov.tipo)) sum += Number(mov.cantidad ?? 0);
      }
      return sum;
    }
    if (rawText.includes('reserva') && rawText.includes('liberacion')) {
      let sum = 0;
      for (const jr of group) {
        const mov = jr['movimientos_stock'];
        if (!mov) continue;
        if (mov.tipo === 'reserva') sum += Number(mov.cantidad ?? 0);
        else if (mov.tipo === 'liberacion') sum -= Number(mov.cantidad ?? 0);
      }
      return sum;
    }

    // Warranty cases in /informes
    const hasGarantia = vals.some((v) => v && typeof v === 'object' && JSON.stringify(v).toLowerCase().includes('garant'));
    if (hasGarantia) {
      const valCol = vals.find((v) => v && typeof v === 'object' && v.table && v.column);
      let sum = 0;
      for (const jr of group) {
        const orden = jr['ordenes'];
        const isGar = orden?.estado === 'Garantia' || orden?.estado === 'Garant\u00eda' || Boolean(orden?.garantia);
        if (!isGar) continue;
        if (valCol) sum += Number(getCol(jr[valCol.table], valCol.column) ?? 0);
        else sum += 1;
      }
      return sum;
    }

    // Standard sum(table.column)
    const targetCol = vals.find((v) => v && typeof v === 'object' && v.table && v.column);
    if (targetCol) {
      const seen = new Set<any>();
      let sum = 0;
      for (const jr of group) {
        const row = jr[targetCol.table];
        if (!row) continue;
        const rowId = getCol(row, 'id');
        if (rowId !== undefined) {
          if (seen.has(rowId)) continue;
          seen.add(rowId);
        }
        sum += Number(getCol(row, targetCol.column) ?? 0);
      }
      return sum;
    }

    return 0;
  }

  private projectJoined(jr: JoinedRow): any {
    const baseRow = jr[this.tableName] ?? {};
    if (!this._projection || typeof this._projection !== 'object') return baseRow;
    const out: Record<string, any> = {};
    for (const [alias, spec] of Object.entries(this._projection as Record<string, any>)) {
      if (!spec) {
        out[alias] = null;
      } else if (typeof spec === 'string') {
        out[alias] = getCol(baseRow, spec);
      } else if (spec.tableName) {
        out[alias] = jr[spec.tableName] ?? baseRow;
      } else if (spec.column) {
        const tbl = spec.table ? jr[spec.table] : baseRow;
        out[alias] = getCol(tbl, spec.column) ?? null;
      } else {
        out[alias] = baseRow;
      }
    }
    return out;
  }

  async execute(): Promise<any[]> {
    let activeClient = this.client;
    try {
      const { cookies } = await import('next/headers');
      const c = await cookies();
      const token = c.get('sb-auth-token')?.value;
      if (token) activeClient = ensureClient(decodeURIComponent(token));
    } catch {}

    let query: any;
    if (this.mode === 'select') {
      query = this.applyBaseFilters(activeClient.from(this.tableName).select(this.projection));
    } else if (this.mode === 'insert') {
      query = activeClient.from(this.tableName).insert(this.payload).select('*');
    } else if (this.mode === 'update') {
      query = this.applyBaseFilters(activeClient.from(this.tableName).update(this.payload)).select('*');
    } else {
      query = this.applyBaseFilters(activeClient.from(this.tableName).delete()).select('*');
    }

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseBuilder error]', this.tableName, error.message);
      if (this.mode === 'select') return [];
      throw error;
    }

    const rawRows = (data ?? []).map((r: any) => mapRow(r)!);
    if (this.mode !== 'select') return rawRows;

    let joinedRows: JoinedRow[] = rawRows.map((r) => ({ [this.tableName]: r }));

    for (const join of this.joins) {
      const otherRows = await this.fetchTable(activeClient, join.table);
      const keys = this.extractJoinKeys(join);
      const next: JoinedRow[] = [];

      for (const jr of joinedRows) {
        if (!keys) {
          if (join.left) next.push({ ...jr, [join.table]: null });
          continue;
        }
        const sourceRow = keys.otherTable ? jr[keys.otherTable] : jr[this.tableName];
        const leftVal = getCol(sourceRow, keys.otherCol);
        const matches = leftVal == null
          ? []
          : otherRows.filter((orow) => getCol(orow, keys.joinCol) === leftVal);

        if (matches.length > 0) {
          for (const m of matches) next.push({ ...jr, [join.table]: m });
        } else if (join.left) {
          next.push({ ...jr, [join.table]: null });
        }
      }
      joinedRows = next;
    }

    if (this.filters.length > 0 && (this.joins.length > 0 || this.filters.some((f) => f?.kind === 'raw' || f?.kind === 'or'))) {
      joinedRows = joinedRows.filter((jr) => this.filters.every((f) => this.evalCondition(jr, f)));
    }

    const hasAgg = this.groupFields.length > 0 || (
      this._projection && typeof this._projection === 'object' &&
      Object.values(this._projection).some((v: any) => v && typeof v === 'object' && (v.kind === 'count' || v.kind === 'raw'))
    );

    let result: any[];
    if (hasAgg) {
      const groups = new Map<string, JoinedRow[]>();
      if (this.groupFields.length === 0) {
        groups.set('__all__', joinedRows);
      } else {
        for (const jr of joinedRows) {
          const key = this.groupFields.map((gf) => {
            const tbl = gf?.table ? jr[gf.table] : jr[this.tableName];
            const col = typeof gf === 'string' ? gf : gf?.column ?? '';
            return String(getCol(tbl, col) ?? '');
          }).join('::');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(jr);
        }
      }

      result = [];
      for (const grp of groups.values()) {
        const sample = grp[0] ?? { [this.tableName]: {} };
        const out: Record<string, any> = {};
        for (const [alias, spec] of Object.entries((this._projection ?? {}) as Record<string, any>)) {
          if (spec && typeof spec === 'object' && (spec.kind === 'count' || spec.kind === 'raw')) {
            out[alias] = this.evalSqlExpr(spec, grp);
          } else if (spec?.tableName) {
            out[alias] = sample[spec.tableName] ?? sample[this.tableName] ?? null;
          } else if (spec?.column) {
            const tbl = spec.table ? sample[spec.table] : sample[this.tableName];
            out[alias] = getCol(tbl, spec.column) ?? null;
          } else {
            out[alias] = null;
          }
        }
        result.push(out);
      }
    } else {
      result = joinedRows.map((jr) => this.projectJoined(jr));
    }

    if (this.order.length > 0 && (this.joins.length > 0 || hasAgg)) {
      for (let i = this.order.length - 1; i >= 0; i--) {
        const o = this.order[i]!;
        const dir = o.dir === 'asc' ? 1 : -1;
        result.sort((a, b) => {
          const av = o.raw ? (a.n ?? 0) : (a[o.field] ?? a[toCamel(o.field)] ?? a.o?.[toCamel(o.field)] ?? a.c?.[toCamel(o.field)] ?? '');
          const bv = o.raw ? (b.n ?? 0) : (b[o.field] ?? b[toCamel(o.field)] ?? b.o?.[toCamel(o.field)] ?? b.c?.[toCamel(o.field)] ?? '');
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }
    }

    if (this.limitValue && (this.joins.length > 0 || hasAgg)) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const db: any = {};
db.select = (projection?: any) => new SupabaseBuilder(base).select(projection);
db.from = (table: any) => new SupabaseBuilder(base, typeof table === 'string' ? table : table?.tableName);
db.insert = (payload: any) => payload && payload.tableName ? new SupabaseBuilder(base, payload.tableName).insert(null) : new SupabaseBuilder(base).insert(payload);
db.update = (payload: any) => payload && payload.tableName ? new SupabaseBuilder(base, payload.tableName).update({}) : new SupabaseBuilder(base).update(payload);
db.delete = () => new SupabaseBuilder(base).delete();
db.batch = (items: any[]) => Promise.all(items.map((item: any) => item?.execute ? item.execute() : item));
db.run = (_sql: any) => { throw new Error('SQL Drizzle/SQLite no soportado'); };

export const supabase: SupabaseClient | null = base;
export { db };
