import { randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const roleName = 'roster_app_backup';
const { database, target: ownerUrl, cutover } = assertTarget({ purpose: 'backup role provisioning' });
const defaultOutput = cutover
  ? '.env.postgres-backup-cutover.local'
  : '.env.postgres-backup.local';
const outputPath = path.resolve(process.env.POSTGRES_BACKUP_ENV_FILE || defaultOutput);
const backupDirectory = process.env.POSTGRES_BACKUP_DIRECTORY;
if (!backupDirectory || !path.isAbsolute(backupDirectory)) {
  throw new Error('POSTGRES_BACKUP_DIRECTORY must be an absolute path');
}
if (!process.env.PG16_BIN || !path.isAbsolute(process.env.PG16_BIN)) {
  throw new Error('PG16_BIN must be an absolute path');
}

let password;
const outputExists = await access(outputPath).then(() => true).catch(() => false);
if (outputExists) {
  const existing = await readFile(outputPath, 'utf8');
  const line = existing.match(/^DATABASE_URL=(.+)$/m)?.[1];
  if (!line) throw new Error('Existing backup environment has no DATABASE_URL');
  const existingUrl = new URL(line);
  if (decodeURIComponent(existingUrl.username) !== roleName) {
    throw new Error('Existing backup environment belongs to a different database role');
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
    throw new Error('Apply 023_backup_privileges.sql before provisioning the backup login');
  }
  const quoted = await client.query('select quote_literal($1) as password', [password]);
  await client.query(`alter role roster_app_backup with login nosuperuser nocreatedb
    nocreaterole noinherit noreplication bypassrls connection limit 1
    password ${quoted.rows[0].password}`);
} finally {
  await client.end();
}

const backupUrl = new URL(ownerUrl.toString());
backupUrl.username = roleName;
backupUrl.password = password;
await writeFile(outputPath, [
  `DATABASE_URL=${backupUrl.toString()}`,
  `NATIVE_MIGRATION_DATABASE=${database}`,
  `PG16_BIN=${process.env.PG16_BIN}`,
  `POSTGRES_BACKUP_DIRECTORY=${path.resolve(backupDirectory)}`,
  'NATIVE_BACKUP_EXECUTION_ENABLED=false',
  '',
].join('\n'), { encoding: 'utf8', mode: 0o600 });
console.log(`Provisioned ${roleName}; disabled-by-default backup environment written without displaying credentials.`);

