import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

if (process.env.NATIVE_BACKUP_EXECUTION_ENABLED !== 'true') {
  throw new Error('NATIVE_BACKUP_EXECUTION_ENABLED must be true');
}
for (const name of ['DATABASE_URL', 'NATIVE_MIGRATION_DATABASE', 'PG16_BIN', 'POSTGRES_BACKUP_DIRECTORY']) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const connection = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(connection.pathname.slice(1));
if (!['postgres:', 'postgresql:'].includes(connection.protocol) || database !== process.env.NATIVE_MIGRATION_DATABASE) {
  throw new Error('DATABASE_URL must target NATIVE_MIGRATION_DATABASE exactly');
}
if (decodeURIComponent(connection.username) !== 'roster_app_backup') {
  throw new Error('Backups must use the roster_app_backup database role');
}
const backupRoot = path.resolve(process.env.POSTGRES_BACKUP_DIRECTORY);
if (!path.isAbsolute(process.env.POSTGRES_BACKUP_DIRECTORY)) {
  throw new Error('POSTGRES_BACKUP_DIRECTORY must be an absolute path');
}

const run = promisify(execFile);
const pgDump = path.join(process.env.PG16_BIN, 'pg_dump.exe');
const pgRestore = path.join(process.env.PG16_BIN, 'pg_restore.exe');
const { stdout: version } = await run(pgDump, ['--version'], { windowsHide: true });
if (!/\(PostgreSQL\) 16\./.test(version)) throw new Error('PG16_BIN must contain PostgreSQL 16 clients');

await mkdir(backupRoot, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = await mkdtemp(path.join(backupRoot, `roster-production-${timestamp}-`));
const partial = path.join(output, 'database.dump.partial');
const archive = path.join(output, 'database.dump');
const env = {
  ...process.env,
  PGHOST: connection.hostname,
  PGPORT: connection.port || '5432',
  PGUSER: decodeURIComponent(connection.username),
  PGPASSWORD: decodeURIComponent(connection.password),
  PGDATABASE: database,
  PGCONNECT_TIMEOUT: '15',
};

try {
  const { stderr } = await run(pgDump, [
    '--no-password', '--format=custom', '--no-owner', '--lock-wait-timeout=15000',
    `--file=${partial}`,
  ], { env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const { stdout: contents } = await run(pgRestore, ['--list', partial], {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!contents.includes('TABLE DATA')) throw new Error('Backup archive has no table data');

  const digest = createHash('sha256');
  for await (const chunk of createReadStream(partial)) digest.update(chunk);
  const sha256 = digest.digest('hex');
  await rename(partial, archive);
  await writeFile(path.join(output, 'contents.txt'), contents, { flag: 'wx' });
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    database,
    archive: 'database.dump',
    sha256,
    hasWarnings: Boolean(stderr.trim()),
    serverMajorVersion: 16,
  }, null, 2), { flag: 'wx' });
  if (stderr.trim()) await writeFile(path.join(output, 'backup-warnings.txt'), stderr, { flag: 'wx' });
  console.log(`Verified PostgreSQL backup created: ${output}`);
  console.log(`SHA256: ${sha256}`);
} catch (error) {
  const diagnostic = String(error?.stderr || error?.message || error)
    .replaceAll(process.env.DATABASE_URL, '[REDACTED_CONNECTION_URL]')
    .replaceAll(decodeURIComponent(connection.password), '[REDACTED_PASSWORD]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_CONNECTION_URL]')
    .slice(0, 8000);
  await writeFile(path.join(output, 'backup-error.txt'), diagnostic, { flag: 'wx' }).catch(() => {});
  console.error(`Backup failed; incomplete output retained at ${output}`);
  throw error;
}

