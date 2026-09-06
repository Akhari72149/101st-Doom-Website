import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const run = promisify(execFile);
const { database, target, cutover } = assertTarget({ purpose: 'source restore' });
const archive = process.env.POSTGRES_SOURCE_ARCHIVE;
const pgRestore = path.join(process.env.PG17_BIN || '', 'pg_restore.exe');
const psql = path.join(process.env.PG16_BIN || '', 'psql.exe');

if (!process.env.POSTGRES_ADMIN_URL || !archive || !process.env.PG17_BIN || !process.env.PG16_BIN) {
  throw new Error('POSTGRES_ADMIN_URL, DATABASE_URL, NATIVE_MIGRATION_DATABASE, POSTGRES_SOURCE_ARCHIVE, PG17_BIN and PG16_BIN are required');
}

const admin = new pg.Client({ connectionString: process.env.POSTGRES_ADMIN_URL });
try {
  await admin.connect();
  for (const role of ['authenticated', 'supabase_functions_admin']) {
    const existing = await admin.query('select 1 from pg_roles where rolname = $1', [role]);
    if (!existing.rowCount) {
      await admin.query(`create role "${role}" nologin`);
    }
  }
} finally {
  await admin.end();
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const tables = await client.query(`
    select count(*)::int as count
    from pg_tables
    where schemaname not in ('pg_catalog', 'information_schema')
  `);
  if (tables.rows[0].count !== 0) {
    throw new Error('Target contains tables; refusing to restore over an existing database');
  }

  await client.query('create schema if not exists extensions');
  await client.query('create schema if not exists auth');
  await client.query('create extension if not exists pgcrypto with schema extensions');
  await client.query('create extension if not exists "uuid-ossp" with schema extensions');
} finally {
  await client.end();
}

const connection = {
  ...process.env,
  PGHOST: target.hostname,
  PGPORT: target.port || '5432',
  PGUSER: decodeURIComponent(target.username),
  PGPASSWORD: decodeURIComponent(target.password),
  PGDATABASE: decodeURIComponent(target.pathname.slice(1)),
};
delete connection.PGSERVICE;

try {
  const sourceSql = `${archive}.pg17.sql`;
  const compatibleSql = `${archive}.pg16.sql`;
  const { stderr: generationWarnings } = await run(pgRestore, [
    '--no-owner',
    '--no-privileges',
    '--schema=public',
    '--schema=auth',
    '--schema=extensions',
    `--file=${sourceSql}`,
    archive,
  ], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });

  const generated = await readFile(sourceSql, 'utf8');
  const incompatibleSetting = /^SET transaction_timeout = 0;\r?\n/gm;
  const occurrences = generated.match(incompatibleSetting)?.length || 0;
  if (occurrences !== 1) {
    throw new Error(`Expected one PostgreSQL 17 transaction_timeout setting, found ${occurrences}`);
  }
  await writeFile(compatibleSql, generated.replace(incompatibleSetting, ''), { flag: 'w' });

  const { stderr: restoreWarnings } = await run(psql, [
    '--no-password',
    '--set=ON_ERROR_STOP=1',
    '--single-transaction',
    `--dbname=${database}`,
    `--file=${compatibleSql}`,
  ], { env: connection, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });

  const warnings = [generationWarnings, restoreWarnings]
    .filter((value) => value.trim())
    .join('\n');
  if (warnings) {
    await writeFile(`${archive}.restore-warnings.txt`, warnings, { flag: 'w' });
  }
  console.log(`Restored application and auth schemas into ${cutover ? 'cutover' : 'rehearsal'} database ${database}`);
} catch (error) {
  const diagnostic = String(error.stderr || error.message)
    .replaceAll(connection.PGPASSWORD || '', '[REDACTED_PASSWORD]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_CONNECTION_URL]')
    .trim()
    .slice(0, 12000);
  if (diagnostic) console.error(diagnostic);
  process.exitCode = 1;
}
