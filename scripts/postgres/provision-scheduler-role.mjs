import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const roleName = 'roster_app_scheduler';
const { database, target: ownerUrl } = assertTarget({ purpose: 'scheduler role provisioning' });
const outputPath = path.resolve(process.env.POSTGRES_SCHEDULER_ENV_FILE || '.env.postgres-scheduler.local');
const password = randomBytes(48).toString('base64url');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const existing = await client.query('select 1 from pg_roles where rolname = $1', [roleName]);
  if (!existing.rowCount) {
    throw new Error('Apply 022_scheduler_privileges.sql before provisioning the scheduler login');
  }
  const quoted = await client.query('select quote_literal($1) as password', [password]);
  await client.query(`alter role roster_app_scheduler with login nosuperuser nocreatedb
    nocreaterole noinherit noreplication nobypassrls connection limit 2
    password ${quoted.rows[0].password}`);
} finally {
  await client.end();
}

const schedulerUrl = new URL(ownerUrl.toString());
schedulerUrl.username = roleName;
schedulerUrl.password = password;
await writeFile(outputPath, [
  `DATABASE_URL=${schedulerUrl.toString()}`,
  `NATIVE_MIGRATION_DATABASE=${database}`,
  'SCHEDULED_JOB_EXECUTION_ENABLED=false',
  '',
].join('\n'), { encoding: 'utf8', mode: 0o600 });
console.log(`Provisioned ${roleName}; disabled-by-default scheduler environment written without displaying credentials.`);
