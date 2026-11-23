// Compatibilidad mínima para referencias heredadas; no usa Drizzle ni LibSQL.
export type SQL = { kind: string; field?: any; value?: unknown; items?: SQL[]; strings?: TemplateStringsArray; values?: unknown[] };
export type BatchItem = any;
export type BatchResponse<T> = T;

const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const text = (column?: string) => (key = '') => ({ column: column ?? snake(key), kind: 'text' });
export const integer = (column?: string, _options?: any) => (key = '') => ({ column: column ?? snake(key), kind: 'integer' });
export const check = (..._args: any[]) => ({ kind: 'check' });
export const index = (..._args: any[]) => ({ kind: 'index' });
export const uniqueIndex = (..._args: any[]) => ({ kind: 'uniqueIndex' });
export const customType = (_: any) => (column?: string) => (key = '') => ({ column: column ?? snake(key) });

export const sqliteTable = (name: string, columns: Record<string, any>, _extra?: any) => {
  const table: any = { tableName: name, name };
  for (const [key, factory] of Object.entries(columns)) {
    const value = typeof factory === 'function' ? factory(key) : factory;
    const field = typeof value === 'object' && value !== null ? value : { column: snake(key) };
    field.table = name; field.column = field.column ?? snake(key);
    table[key] = field;
  }
  table.toString = () => name;
  return table;
};

export const sql = (strings: TemplateStringsArray, ...values: unknown[]): SQL => ({ kind: 'raw', strings, values });
const fieldName = (field: any): string => typeof field === 'string' ? field : field?.column ?? String(field ?? '');
export const eq = (field: any, value: unknown): SQL => ({ kind: 'eq', field: fieldName(field), value });
export const ne = (field: any, value: unknown): SQL => ({ kind: 'ne', field: fieldName(field), value });
export const gte = (field: any, value: unknown): SQL => ({ kind: 'gte', field: fieldName(field), value });
export const gt = (field: any, value: unknown): SQL => ({ kind: 'gt', field: fieldName(field), value });
export const lte = (field: any, value: unknown): SQL => ({ kind: 'lte', field: fieldName(field), value });
export const lt = (field: any, value: unknown): SQL => ({ kind: 'lt', field: fieldName(field), value });
export const like = (field: any, value: unknown): SQL => ({ kind: 'like', field: fieldName(field), value });
export const inArray = (field: any, values: readonly unknown[]): SQL => ({ kind: 'in', field: fieldName(field), value: values });
export const notInArray = (field: any, values: readonly unknown[]): SQL => ({ kind: 'notIn', field: fieldName(field), value: values });
export const and = (...items: (SQL | undefined)[]): SQL => ({ kind: 'and', items: items.filter(Boolean) as SQL[] });
export const or = (...items: (SQL | undefined)[]): SQL => ({ kind: 'or', items: items.filter(Boolean) as SQL[] });
export const desc = (field: any) => ({ field: fieldName(field), direction: 'desc' });
export const asc = (field: any) => ({ field: fieldName(field), direction: 'asc' });
export const count = (field?: any): SQL => ({ kind: 'count', field: field ? fieldName(field) : '*' });

export class APIError extends Error { constructor(public code: string, public data?: any) { super(typeof data?.message === 'string' ? data.message : code); } }
export const createAuthMiddleware = (_: any) => (_handler: any) => _handler;
export const getIP = (_: any, _options?: any) => 'unknown';
export const isAPIError = (value: unknown) => value instanceof APIError;
