import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { postgresConfig } from '../../src/lib/postgres/config.mjs';
import { makeAuthOptions } from '../../src/lib/postgres/auth-options.mjs';

const pool = new Pool(postgresConfig());
try {
  const plan = await getMigrations(makeAuthOptions(pool));
  if (process.argv.includes('--apply')) {
    if (process.env.NATIVE_MIGRATION_DATABASE !== new URL(process.env.DATABASE_URL).pathname.slice(1)) {
      throw new Error('Set NATIVE_MIGRATION_DATABASE to the destination database name before applying');
    }
    await plan.runMigrations();
    console.log('Native authentication schema applied. No existing Supabase tables were removed.');
  } else {
    console.log(await plan.compileMigrations());
    console.log('-- Preview only. Pass --apply to execute against the explicitly selected database.');
  }
} catch (error) {
  console.error('Auth schema preparation failed:', error.code || error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
