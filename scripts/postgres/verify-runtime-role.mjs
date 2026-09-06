import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { postgresConfig } from '../../src/lib/postgres/config.mjs';

const expectedRole = 'roster_app_runtime';
const requiredPrivileges = [
  ['public.app_auth_users', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.app_auth_accounts', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.app_auth_sessions', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.app_auth_verifications', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.app_auth_rate_limits', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.app_page_permissions', 'SELECT'],
  ['public.profiles', 'SELECT'],
  ['public.personnel', 'SELECT'],
  ['public.personnel_certifications', 'SELECT,INSERT,DELETE'],
  ['public.recurring_server_blocks', 'SELECT'],
  ['public.ranks', 'SELECT'],
  ['public.rank_history', 'SELECT'],
  ['public.certifications', 'SELECT'],
  ['public.audit_logs', 'SELECT'],
  ['public.attendance_records', 'SELECT,UPDATE'],
  ['public.taskboard_tasks', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.taskboard_comments', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.awards', 'SELECT'],
  ['public.personnel_awards', 'SELECT,INSERT,DELETE'],
  ['public.personnel_steam_links', 'SELECT'],
  ['public.personnel_xp_profiles', 'SELECT'],
  ['public.personnel_xp_weekly_stats', 'SELECT'],
  ['public.personnel_xp_weekly_target_stats', 'SELECT'],
  ['public.personnel_medical_profiles', 'SELECT'],
  ['public.personnel_medical_weekly_stats', 'SELECT'],
  ['public.org_nodes', 'SELECT'],
  ['public.user_page_permissions', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.user_roles', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.server_bookings', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.discord_role_outbox', 'SELECT,UPDATE'],
  ['public.discord_announcements', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.discord_attendance_events', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.discord_attendance_options', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.discord_attendance_responses', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.steam_link_sessions', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.personnel_discord_verification_challenges', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.personnel_steam_links', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.personnel_steam_link_audit', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.arma_campaign_status_current', 'SELECT,INSERT,UPDATE'],
  ['public.arma_campaign_status_history', 'SELECT,INSERT,UPDATE'],
  ['public.arma_campaign_story_episodes', 'SELECT'],
  ['public.arma_campaign_story_objectives', 'SELECT'],
  ['public.operation_plans', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.mod_pipeline_assignees', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.mod_pipeline_tasks', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.mod_pipeline_comments', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.side_operations', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.side_operation_signups', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.side_operation_levels', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.platoons', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.hq_assets', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.token_transactions', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.platoon_assets', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.cis_commander', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.cis_assets', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.cis_commander_assets', 'SELECT,INSERT,UPDATE,DELETE'],
  ['public.cis_transactions', 'SELECT,INSERT,UPDATE,DELETE'],
];
const forbiddenTables = ['auth.users'];
const protectedFunctions = [
  'record_arma_xp_event',
  'record_arma_medical_event',
  'reset_arma_xp_weekly_data',
  'finalize_steam_link_from_discord',
];

const pool = new Pool(postgresConfig());
try {
  const role = await pool.query(`select current_user as role, rolsuper, rolbypassrls,
    rolcreatedb, rolcreaterole from pg_roles where rolname = current_user`);
  assert.equal(role.rows[0]?.role, expectedRole, `Expected ${expectedRole}`);
  assert.equal(role.rows[0].rolsuper, false, 'Runtime role must not be a superuser');
  assert.equal(role.rows[0].rolbypassrls, false, 'Runtime role must not bypass RLS');
  assert.equal(role.rows[0].rolcreatedb, false, 'Runtime role must not create databases');
  assert.equal(role.rows[0].rolcreaterole, false, 'Runtime role must not create roles');

  if (process.env.NATIVE_MIGRATION_DATABASE) {
    const database = await pool.query('select current_database() as database');
    assert.equal(database.rows[0].database, process.env.NATIVE_MIGRATION_DATABASE,
      'Runtime URL points at the wrong database');
  }

  for (const [table, privileges] of requiredPrivileges) {
    const result = await pool.query(
      'select has_table_privilege(current_user, $1, $2) as allowed',
      [table, privileges],
    );
    assert.equal(result.rows[0].allowed, true, `Missing ${privileges} on ${table}`);
  }

  for (const table of forbiddenTables) {
    const schema = table.split('.')[0];
    const schemaAccess = await pool.query(
      'select has_schema_privilege(current_user, $1, $2) as allowed',
      [schema, 'USAGE'],
    );
    if (!schemaAccess.rows[0].allowed) continue;
    const exists = await pool.query('select to_regclass($1) as relation', [table]);
    if (!exists.rows[0].relation) continue;
    const result = await pool.query(
      'select has_table_privilege(current_user, $1, $2) as allowed',
      [table, 'SELECT'],
    );
    assert.equal(result.rows[0].allowed, false, `Unexpected SELECT access on ${table}`);
  }

  const functions = await pool.query(`select p.oid,
      p.oid::regprocedure::text as signature,
      has_function_privilege(current_user, p.oid, 'EXECUTE') as runtime_execute,
      has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($1::text[])
    order by signature`, [protectedFunctions]);
  assert.ok(functions.rowCount >= protectedFunctions.length, 'Expected protected functions were not found');
  for (const fn of functions.rows) {
    assert.equal(fn.runtime_execute, true, `Runtime cannot execute ${fn.signature}`);
    assert.equal(fn.public_execute, false, `PUBLIC can still execute ${fn.signature}`);
  }

  console.log(`PASS: ${expectedRole} has only the checked application privileges; sensitive tables and protected functions are not public.`);
} finally {
  await pool.end();
}
