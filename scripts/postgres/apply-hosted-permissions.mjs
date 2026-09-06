import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const connectionString = process.env.SOURCE_DATABASE_URL;
const certificatePath = process.env.PGSSLROOTCERT;

if (!connectionString || !certificatePath) {
  throw new Error('SOURCE_DATABASE_URL and PGSSLROOTCERT are required');
}

const url = new URL(connectionString);
if (!url.hostname.endsWith('.supabase.com')) {
  throw new Error('This command only accepts a hosted Supabase database connection');
}

url.searchParams.delete('sslmode');
url.searchParams.delete('sslrootcert');
const ca = await readFile(certificatePath, 'utf8');
const migrationPaths = [
  path.resolve('supabase/migrations/202609041200_create_page_permissions.sql'),
  path.resolve('supabase/migrations/202609051200_add_server_booking_permission.sql'),
];
const migrations = await Promise.all(
  migrationPaths.map(async (migrationPath) => ({
    name: path.basename(migrationPath),
    sql: await readFile(migrationPath, 'utf8'),
  })),
);
const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { ca, rejectUnauthorized: true },
  application_name: 'roster-hosted-permission-migration',
});

async function inspect() {
  const tables = await client.query(`
    select
      to_regclass('public.app_page_permissions') is not null as has_definitions,
      to_regclass('public.user_page_permissions') is not null as has_assignments
  `);
  const state = tables.rows[0];
  if (!state.has_definitions || !state.has_assignments) {
    return { installed: false, definitions: 0, assignments: 0, serverBookingGrants: 0 };
  }

  const totals = await client.query(`
    select
      (select count(*)::integer from public.app_page_permissions) as definitions,
      (select count(*)::integer from public.user_page_permissions) as assignments,
      (select count(*)::integer
         from public.user_page_permissions
        where permission_key = 'operations.server-bookings') as server_booking_grants,
      exists (
        select 1 from public.app_page_permissions
        where permission_key = 'operations.server-bookings' and page_path = '/servers'
      ) as installed
  `);
  const security = await client.query(`
    select
      bool_and(c.relrowsecurity) as rls_enabled,
      (select count(*)::integer
         from pg_policies
        where schemaname = 'public'
          and tablename in ('app_page_permissions', 'user_page_permissions')) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('app_page_permissions', 'user_page_permissions')
  `);
  return {
    installed: totals.rows[0].installed,
    definitions: totals.rows[0].definitions,
    assignments: totals.rows[0].assignments,
    serverBookingGrants: totals.rows[0].server_booking_grants,
    rlsEnabled: security.rows[0].rls_enabled,
    policies: security.rows[0].policies,
  };
}

await client.connect();
try {
  const before = await inspect();
  if (!apply) {
    console.log(JSON.stringify({
      mode: 'preview',
      before,
      migrations: migrations.map((migration) => migration.name),
    }, null, 2));
  } else {
    await client.query('begin');
    try {
      for (const migration of migrations) await client.query(migration.sql);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const after = await inspect();
    if (!after.installed || after.definitions !== 17 || !after.rlsEnabled || after.policies !== 2) {
      throw new Error('Migration verification failed');
    }
    console.log(JSON.stringify({ mode: 'applied', before, after }, null, 2));
  }
} finally {
  await client.end();
}
