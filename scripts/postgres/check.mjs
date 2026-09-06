import { Pool } from 'pg';
import { postgresConfig } from '../../src/lib/postgres/config.mjs';

const pool = new Pool(postgresConfig());
try {
  const { rows } = await pool.query(`select current_database() as database,
    current_user as role, current_setting('server_version') as version,
    rolsuper as superuser, rolbypassrls as bypass_rls
    from pg_roles where rolname = current_user`);
  console.table(rows);
  if (rows[0].superuser || rows[0].bypass_rls) {
    console.error('Use a non-superuser, non-BYPASSRLS role for the application runtime.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('PostgreSQL connection check failed:', error.code || 'CONNECTION_FAILED');
  process.exitCode = 1;
} finally { await pool.end(); }
