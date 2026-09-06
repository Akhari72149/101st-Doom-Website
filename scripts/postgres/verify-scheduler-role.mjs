import assert from 'node:assert/strict';
import pg from 'pg';

const functions = [
  'public.reset_arma_xp_weekly_data()',
  'public.ensure_current_attendance_week()',
  'public.reset_server_bookings_weekly()',
  'public.shift_recurring_server_blocks_week()',
];
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const role = await client.query(`select current_user as role, rolsuper, rolbypassrls,
    rolcreatedb, rolcreaterole from pg_roles where rolname=current_user`);
  assert.equal(role.rows[0]?.role, 'roster_app_scheduler');
  for (const attribute of ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole']) {
    assert.equal(role.rows[0][attribute], false, `Scheduler role must not have ${attribute}`);
  }
  for (const signature of functions) {
    const privilege = await client.query(
      `select has_function_privilege(current_user,$1,'EXECUTE') scheduler_execute,
        has_function_privilege('public',$1,'EXECUTE') public_execute`,
      [signature],
    );
    assert.equal(privilege.rows[0].scheduler_execute, true, `Missing EXECUTE on ${signature}`);
    assert.equal(privilege.rows[0].public_execute, false, `PUBLIC can execute ${signature}`);
  }
  const broadAccess = await client.query(`select has_table_privilege(current_user,
    'public.personnel','SELECT,INSERT,UPDATE,DELETE') as allowed`);
  assert.equal(broadAccess.rows[0].allowed, false, 'Scheduler unexpectedly has broad personnel access');
  console.log('PASS: roster_app_scheduler can execute only the checked maintenance functions, which are not public.');
} finally {
  await client.end();
}
