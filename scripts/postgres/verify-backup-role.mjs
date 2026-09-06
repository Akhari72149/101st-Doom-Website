import assert from 'node:assert/strict';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const role = await client.query(`select current_user as role, rolsuper, rolbypassrls,
    rolcreatedb, rolcreaterole from pg_roles where rolname=current_user`);
  assert.equal(role.rows[0]?.role, 'roster_app_backup');
  assert.equal(role.rows[0].rolsuper, false, 'Backup role must not be superuser');
  assert.equal(role.rows[0].rolbypassrls, true, 'Backup role must bypass RLS for complete exports');
  assert.equal(role.rows[0].rolcreatedb, false, 'Backup role must not create databases');
  assert.equal(role.rows[0].rolcreaterole, false, 'Backup role must not create roles');

  for (const table of ['public.personnel', 'public.app_auth_users']) {
    const privileges = await client.query(
      `select has_table_privilege(current_user,$1,'SELECT') as can_select,
        has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE') as can_write`,
      [table],
    );
    assert.equal(privileges.rows[0].can_select, true, `Missing SELECT on ${table}`);
    assert.equal(privileges.rows[0].can_write, false, `Backup role can modify ${table}`);
  }
  console.log('PASS: roster_app_backup can read protected application data but cannot modify it.');
} finally {
  await client.end();
}

