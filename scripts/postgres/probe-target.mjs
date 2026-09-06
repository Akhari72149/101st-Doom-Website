import pg from 'pg';

const useTarget = process.argv.includes('--target');
const connectionString = useTarget
  ? process.env.DATABASE_URL
  : process.env.POSTGRES_ADMIN_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('POSTGRES_ADMIN_URL or DATABASE_URL is required');
}

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const result = await client.query(`
    select
      current_setting('server_version') as version,
      current_database() as database,
      current_user as username,
      (select rolcreatedb from pg_roles where rolname = current_user) as can_create_database,
      (select rolsuper from pg_roles where rolname = current_user) as is_superuser
  `);
  const extensions = await client.query(`
    select name, default_version, installed_version
    from pg_available_extensions
    where name = any($1::text[])
    order by name
  `, [[
    'http', 'pg_cron', 'pg_net', 'pg_stat_statements',
    'pgcrypto', 'supabase_vault', 'uuid-ossp',
  ]]);
  console.log(JSON.stringify({ ...result.rows[0], extensions: extensions.rows }, null, 2));
} finally {
  await client.end();
}
