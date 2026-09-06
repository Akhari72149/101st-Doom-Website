export function postgresConfig(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  const max = Number(env.DATABASE_POOL_MAX || 10);
  if (!Number.isInteger(max) || max < 1 || max > 50) {
    throw new Error('DATABASE_POOL_MAX must be between 1 and 50');
  }
  return {
    connectionString: env.DATABASE_URL,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    application_name: 'roster-app',
  };
}

export function nativeAuthConfig(env = process.env) {
  if (!env.NATIVE_AUTH_SECRET || env.NATIVE_AUTH_SECRET.length < 32) {
    throw new Error('NATIVE_AUTH_SECRET must contain at least 32 characters');
  }
  if (!env.APP_ORIGIN) throw new Error('APP_ORIGIN is required');
  const url = new URL(env.APP_ORIGIN);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const insecureLoopbackAllowed = local && url.protocol === 'http:' &&
    (env.NODE_ENV !== 'production' || env.NATIVE_AUTH_ALLOW_INSECURE_LOOPBACK === 'true');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !insecureLoopbackAllowed)) {
    throw new Error('APP_ORIGIN must be HTTPS (HTTP loopback requires an explicit rehearsal setting)');
  }
  return { secret: env.NATIVE_AUTH_SECRET, origin: url.origin };
}
