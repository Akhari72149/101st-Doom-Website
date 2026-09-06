import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { postgresConfig } from '../../src/lib/postgres/config.mjs';
import { hostedSourceConfig } from './hosted-source.mjs';

// Run only after reviewing the explicit UUID -> username map. No cloud writes.
const mappingPath = process.argv[process.argv.indexOf('--mapping') + 1];
const restoredSource = process.argv.includes('--source-restored');
if (!process.argv.includes('--mapping') || !mappingPath) {
  throw new Error('Supply --mapping <private-json-file>');
}
if (!restoredSource && !process.env.SOURCE_DATABASE_URL) {
  throw new Error('Set SOURCE_DATABASE_URL or pass --source-restored');
}
if (!restoredSource && process.env.SOURCE_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('Hosted source and target must differ');
}
const source = restoredSource
  ? new Pool(postgresConfig())
  : new Pool(await hostedSourceConfig());
const target = new Pool(postgresConfig());
try {
  const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
  if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object') throw new Error('Mapping must be a UUID-to-username object');
  const { rows } = await source.query(`select id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, banned_until
    from auth.users where deleted_at is null order by id`);
  const sourceById = new Map(rows.map((row) => [row.id, row]));
  const selectedRows = Object.keys(mapping).map((id) => sourceById.get(id));
  if (!selectedRows.length || selectedRows.some((row) => !row)) {
    throw new Error('Mapping contains an unknown account or selects no accounts');
  }
  const seen = new Set();
  for (const row of selectedRows) {
    const username = mapping[row.id];
    if (typeof username !== 'string' || !/^[a-z0-9_.]{3,40}$/.test(username) || seen.has(username)) {
      throw new Error('Every active source account needs a unique lowercase username (3-40 letters/numbers/underscore/dot)');
    }
    seen.add(username);
    if (!row.email || !/^\$2[aby]\$\d{2}\$/.test(row.encrypted_password || '')) {
      throw new Error('A source account needs a separately reviewed email/password migration; no accounts imported');
    }
  }
  console.log(`Validated ${selectedRows.length} selected account(s) from ${rows.length} active ${restoredSource ? 'restored' : 'hosted'} source account(s). UUIDs, password hashes and disabled status will be preserved.`);
  if (process.argv.includes('--apply')) {
    if (process.env.NATIVE_MIGRATION_DATABASE !== new URL(process.env.DATABASE_URL).pathname.slice(1)) {
      throw new Error('NATIVE_MIGRATION_DATABASE must match the destination database name');
    }
    const client = await target.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE app_auth_users, app_auth_accounts IN EXCLUSIVE MODE');
      for (const row of selectedRows) {
        const existing = await client.query('select id from app_auth_users where id = $1', [row.id]);
        if (existing.rowCount) throw new Error('Destination already contains a mapped account; import aborted without overwriting credentials');
        await client.query(`insert into app_auth_users
          (id, name, email, "emailVerified", "createdAt", "updatedAt", username, "displayUsername", disabled)
          values ($1,$2,$3,$4,$5,$6,$2,$2,$7)`,
        [row.id, mapping[row.id], row.email.toLowerCase(), !!row.email_confirmed_at,
          row.created_at, row.updated_at || row.created_at,
          !!row.banned_until && new Date(row.banned_until).getTime() > Date.now()]);
        await client.query(`insert into app_auth_accounts
          (id, "userId", "accountId", "providerId", issuer, password, "createdAt", "updatedAt")
          values ($1,$2::uuid,$2::text,'credential','local:credential',$3,$4,$5)`,
        [randomUUID(), row.id, row.encrypted_password, row.created_at, row.updated_at || row.created_at]);
      }
      await client.query('COMMIT');
      console.log('Account import committed. Existing login sessions were not copied.');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } else { console.log('Preview only. Add --apply after reviewing the mapping and destination.'); }
} catch (error) {
  console.error('Account import failed:', error.code || error.message);
  process.exitCode = 1;
} finally { await Promise.all([source.end(), target.end()]); }
