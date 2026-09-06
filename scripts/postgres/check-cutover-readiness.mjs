import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const run = promisify(execFile);
const { database } = assertTarget({ purpose: 'cutover readiness check' });
if (!process.argv.includes('--cutover')) throw new Error('Run this check through db:check-cutover');

const required = ['POSTGRES_SOURCE_ARCHIVE', 'PG16_BIN', 'PG17_BIN', 'POSTGRES_RUNTIME_ENV_FILE'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}
if (path.basename(process.env.POSTGRES_RUNTIME_ENV_FILE) !== '.env.postgres-runtime-cutover.local') {
  throw new Error('POSTGRES_RUNTIME_ENV_FILE must be .env.postgres-runtime-cutover.local');
}

const archive = path.resolve(process.env.POSTGRES_SOURCE_ARCHIVE);
const manifestPath = path.join(path.dirname(archive), 'manifest.json');
await Promise.all([access(archive), access(manifestPath)]);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const digest = createHash('sha256');
for await (const chunk of createReadStream(archive)) digest.update(chunk);
if (digest.digest('hex') !== manifest.sha256) throw new Error('Source archive checksum does not match manifest.json');

const [{ stdout: pg16 }, { stdout: pg17 }] = await Promise.all([
  run(path.join(process.env.PG16_BIN, 'psql.exe'), ['--version'], { windowsHide: true }),
  run(path.join(process.env.PG17_BIN, 'pg_restore.exe'), ['--version'], { windowsHide: true }),
]);
if (!/\(PostgreSQL\) 16\./.test(pg16)) throw new Error('PG16_BIN must contain PostgreSQL 16 clients');
if (!/\(PostgreSQL\) 17\./.test(pg17)) throw new Error('PG17_BIN must contain PostgreSQL 17 clients');

const migrationFiles = (await readdir(path.resolve('postgres/migrations')))
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
  .sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const identity = await client.query(`select current_database() as database,
      current_user as role, current_setting('server_version') as version,
      (select rolsuper from pg_roles where rolname = current_user) as superuser`);
  const versionMajor = Number.parseInt(identity.rows[0].version, 10);
  if (versionMajor !== 16) throw new Error(`Cutover target must run PostgreSQL 16; found ${identity.rows[0].version}`);

  const tableCount = await client.query(`select count(*)::int as count from pg_tables
    where schemaname not in ('pg_catalog', 'information_schema')`);
  const migrationTable = await client.query("select to_regclass('public.app_schema_migrations') as table_name");
  let migrationState = 'not-applied';
  if (migrationTable.rows[0].table_name) {
    const applied = await client.query('select name, sha256 from public.app_schema_migrations order by name');
    const appliedByName = new Map(applied.rows.map((row) => [row.name, row.sha256]));
    const missing = [];
    const changed = [];
    for (const file of migrationFiles) {
      const sql = await readFile(path.resolve('postgres/migrations', file), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      if (!appliedByName.has(file)) missing.push(file);
      else if (appliedByName.get(file) !== sha256) changed.push(file);
    }
    if (missing.length || changed.length) {
      throw new Error(`Native migrations are incomplete (missing: ${missing.join(', ') || 'none'}; changed: ${changed.join(', ') || 'none'})`);
    }
    migrationState = `complete (${migrationFiles.length})`;
  }

  const ageHours = (Date.now() - Date.parse(manifest.createdAt)) / 3_600_000;
  console.log(JSON.stringify({
    database,
    serverVersion: identity.rows[0].version,
    migrationRole: identity.rows[0].role,
    migrationRoleIsSuperuser: identity.rows[0].superuser,
    applicationTableCount: tableCount.rows[0].count,
    migrationState,
    sourceArchiveChecksum: 'verified',
    sourceArchiveAgeHours: Number(ageHours.toFixed(1)),
    nextAction: tableCount.rows[0].count === 0
      ? 'Run db:restore-cutover, then db:migrate-cutover.'
      : migrationState === 'not-applied'
        ? 'Run db:migrate-cutover.'
        : 'Provision and verify the runtime role, then complete the browser and worker smoke tests.',
  }, null, 2));
  if (ageHours > 24) {
    console.warn('WARNING: source archive is older than 24 hours; take a fresh export after pausing writers before final cutover.');
  }
} finally {
  await client.end();
}
