import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const mappingPath = path.resolve('.migration-private/native-usernames.json');
const reviewPath = path.resolve('.migration-private/native-username-review.json');
const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
const review = JSON.parse(await readFile(reviewPath, 'utf8'));

if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || !Array.isArray(review)) {
  throw new Error('Private username mapping files are invalid');
}

const reviewedUsernames = new Set(review.map((entry) => entry?.username));
if (reviewedUsernames.has(undefined) || reviewedUsernames.size !== review.length) {
  throw new Error('Every reviewed account must have a unique username');
}

const entries = Object.entries(mapping);
const selectedEntries = entries.filter(([, username]) => reviewedUsernames.has(username));
if (selectedEntries.length !== review.length) {
  throw new Error('Every reviewed username must exist exactly once in the UUID mapping');
}

const database = process.env.NATIVE_MIGRATION_DATABASE;
if (!process.env.DATABASE_URL || !database) {
  throw new Error('DATABASE_URL and NATIVE_MIGRATION_DATABASE are required');
}
const target = new URL(process.env.DATABASE_URL);
if (target.pathname.slice(1) !== database || !/^roster_native_[a-z0-9_]+$/.test(database)) {
  throw new Error('Refusing to modify a database outside the guarded native rehearsal pattern');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const selectedIds = selectedEntries.map(([id]) => id);
  const imported = await client.query('select id::text, username from app_auth_users order by username');
  const excluded = imported.rows.filter((row) => !selectedIds.includes(row.id));
  const report = {
    mode: apply ? 'applied' : 'preview',
    selected: selectedEntries.length,
    excluded: excluded.map((row) => row.username),
  };

  if (apply) {
    await client.query('begin');
    try {
      if (excluded.length) {
        await client.query('delete from app_auth_users where id = any($1::uuid[])', [excluded.map((row) => row.id)]);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    await writeFile(mappingPath, `${JSON.stringify(Object.fromEntries(selectedEntries), null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.end();
}
