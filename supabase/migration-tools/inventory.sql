-- Read-only starting inventory. Run on source and destination; retain privately.
-- This intentionally excludes rows, credentials and function/job bodies.
begin transaction read only;

select version() as postgres_version;

select extname, extversion from pg_extension order by extname;

select nspname as schema_name
from pg_namespace
where nspname not like 'pg_%' and nspname <> 'information_schema'
order by nspname;

-- Estimates only: obtain exact counts and content comparisons for final acceptance.
select n.nspname as schema_name, c.relname as relation_name, c.relkind,
       c.reltuples::bigint as estimated_rows,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       c.relreplident as replica_identity,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
order by n.nspname, c.relname;

select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not like 'pg_%' and n.nspname <> 'information_schema'
order by n.nspname, p.proname, arguments;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies order by schemaname, tablename, policyname;

select event_object_schema, event_object_table, trigger_name,
       event_manipulation, action_timing
from information_schema.triggers
order by event_object_schema, event_object_table, trigger_name;

select pubname, schemaname, tablename
from pg_publication_tables order by pubname, schemaname, tablename;

-- Indicates which optional inventories require follow-up without assuming presence.
select to_regclass('cron.job') as cron_jobs,
       to_regclass('storage.buckets') as storage_buckets,
       to_regclass('storage.objects') as storage_objects,
       to_regclass('vault.secrets') as vault_secrets,
       to_regclass('supabase_migrations.schema_migrations') as migration_history;

commit;
