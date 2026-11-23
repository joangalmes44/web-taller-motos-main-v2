export type Rol = 'cliente' | 'mecanico' | 'recepcion' | 'administracion';

export const users = {
  tableName: 'users', id: 'id', email: 'email', name: 'name', emailVerified: 'email_verified',
  createdAt: 'created_at', updatedAt: 'updated_at',
};
export const sessions = {
  tableName: 'sessions', id: 'id', userId: 'user_id', token: 'token', expiresAt: 'expires_at',
  userAgent: 'user_agent', createdAt: 'created_at',
};
export const accounts = { tableName: 'accounts', id: 'id', userId: 'user_id', providerId: 'provider_id' };
export const verifications = { tableName: 'verifications', id: 'id', identifier: 'identifier', value: 'value', expiresAt: 'expires_at' };
export const rateLimits = { tableName: 'rate_limits', id: 'id', key: 'key', count: 'count', lastRequest: 'last_request' };
