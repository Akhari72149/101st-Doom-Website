import path from 'node:path';

export function exportConfig(env, repositoryRoot) {
  if (!env.SOURCE_DATABASE_URL || !env.PG17_BIN || !env.POSTGRES_BACKUP_DIRECTORY) {
    throw new Error('Set SOURCE_DATABASE_URL, PG17_BIN and POSTGRES_BACKUP_DIRECTORY in the private environment file');
  }
  const source = new URL(env.SOURCE_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(source.protocol) || !source.username || source.pathname.length < 2) {
    throw new Error('A PostgreSQL source connection URL including username and database is required');
  }
  const allowed = new Set(['sslmode', 'sslrootcert', 'sslcert', 'sslkey']);
  for (const key of source.searchParams.keys()) {
    if (!allowed.has(key)) throw new Error('Unsupported connection URL parameter; use a direct or session-pooler connection');
  }
  const directory = path.resolve(env.POSTGRES_BACKUP_DIRECTORY);
  const relative = path.relative(path.resolve(repositoryRoot), directory);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Backups must be outside the source repository');
  }
  if (!path.isAbsolute(env.POSTGRES_BACKUP_DIRECTORY) || !path.isAbsolute(env.PG17_BIN)) {
    throw new Error('Use absolute paths for PG17_BIN and POSTGRES_BACKUP_DIRECTORY');
  }
  const sslmode = source.searchParams.get('sslmode') || 'verify-full';
  if (!['verify-full', 'verify-ca'].includes(sslmode)) {
    throw new Error('Use sslmode=verify-full (or verify-ca) for the hosted database export');
  }
  return {
    directory,
    pgDump: path.join(env.PG17_BIN, 'pg_dump.exe'),
    pgRestore: path.join(env.PG17_BIN, 'pg_restore.exe'),
    connection: {
      PGHOST: source.hostname,
      PGPORT: source.port || '5432',
      PGUSER: decodeURIComponent(source.username),
      PGPASSWORD: decodeURIComponent(source.password),
      PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
      PGSSLMODE: sslmode,
      PGSSLROOTCERT: source.searchParams.get('sslrootcert') || env.PGSSLROOTCERT || 'system',
      PGSSLCERT: source.searchParams.get('sslcert') || '',
      PGSSLKEY: source.searchParams.get('sslkey') || '',
      PGOPTIONS: '-c default_transaction_read_only=on',
      PGCONNECT_TIMEOUT: '15',
    },
  };
}

export function requirePg17Version(output) {
  if (!/\(PostgreSQL\) 17\./.test(output)) throw new Error('Use version 17 export clients; existing PostgreSQL 16 services stay unchanged');
}
