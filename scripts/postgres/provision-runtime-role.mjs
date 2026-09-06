import { randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const roleName = 'roster_app_runtime';
const { database, target: adminUrl } = assertTarget({ purpose: 'runtime role provisioning' });
const outputPath = path.resolve(process.env.POSTGRES_RUNTIME_ENV_FILE || '.env.postgres-runtime.local');
if (!process.env.NATIVE_AUTH_SECRET || process.env.NATIVE_AUTH_SECRET.length < 32) {
  throw new Error('NATIVE_AUTH_SECRET must be at least 32 characters');
}

let password = '';
const outputExists = await access(outputPath).then(() => true).catch(() => false);
if (outputExists) {
  const existing = await readFile(outputPath, 'utf8');
  const line = existing.match(/^DATABASE_URL=(.+)$/m)?.[1];
  if (!line) throw new Error('Existing runtime environment has no DATABASE_URL');
  const existingUrl = new URL(line);
  if (decodeURIComponent(existingUrl.username) !== roleName) {
    throw new Error('Existing runtime environment belongs to a different database role');
  }
  password = decodeURIComponent(existingUrl.password);
} else {
  password = randomBytes(48).toString('base64url');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const existing = await client.query('select 1 from pg_roles where rolname = $1', [roleName]);
  if (!existing.rowCount) {
    await client.query(`create role roster_app_runtime login nosuperuser nocreatedb
      nocreaterole noinherit noreplication nobypassrls connection limit 20`);
  }
  const quoted = await client.query('select quote_literal($1) as password', [password]);
  await client.query(`alter role roster_app_runtime with login nosuperuser nocreatedb
    nocreaterole noinherit noreplication nobypassrls connection limit 20
    password ${quoted.rows[0].password}`);
} finally {
  await client.end();
}

const runtimeUrl = new URL(adminUrl.toString());
runtimeUrl.username = roleName;
runtimeUrl.password = password;
const lines = [
  `DATABASE_URL=${runtimeUrl.toString()}`,
  `DATABASE_POOL_MAX=${process.env.DATABASE_POOL_MAX || '10'}`,
  `APP_ORIGIN=${process.env.APP_ORIGIN || 'http://localhost:3000'}`,
  `NATIVE_AUTH_SECRET=${process.env.NATIVE_AUTH_SECRET}`,
  `NATIVE_MIGRATION_DATABASE=${database}`,
];
await writeFile(outputPath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`Provisioned ${roleName}; private runtime environment written without displaying credentials.`);
