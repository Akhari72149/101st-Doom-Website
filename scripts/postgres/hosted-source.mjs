import { readFile } from 'node:fs/promises';

export async function hostedSourceConfig(env = process.env) {
  if (!env.SOURCE_DATABASE_URL) throw new Error('SOURCE_DATABASE_URL is required');
  const url = new URL(env.SOURCE_DATABASE_URL);
  const localTestSource = env.NODE_ENV === 'test'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (localTestSource) {
    return {
      connectionString: url.toString(),
      options: '-c default_transaction_read_only=on',
      connectionTimeoutMillis: 5000,
    };
  }
  if (!env.PGSSLROOTCERT) throw new Error('PGSSLROOTCERT is required');
  if (!url.hostname.endsWith('.supabase.com')) {
    throw new Error('SOURCE_DATABASE_URL must target hosted Supabase');
  }
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslrootcert');
  return {
    connectionString: url.toString(),
    ssl: { ca: await readFile(env.PGSSLROOTCERT, 'utf8'), rejectUnauthorized: true },
    options: '-c default_transaction_read_only=on',
    connectionTimeoutMillis: 15000,
  };
}
