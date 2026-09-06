import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

assertTarget({ purpose: 'native migration' });

const migrationsDirectory = path.resolve('postgres/migrations');
const files = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
  .sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(
    'create table if not exists public.app_schema_migrations (' +
    'name text primary key, sha256 text not null, ' +
    'applied_at timestamptz not null default now())',
  );
  await client.query('select pg_advisory_lock($1)', [72149001]);
  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'select sha256 from public.app_schema_migrations where name = $1',
        [file],
      );
      if (existing.rowCount) {
        if (existing.rows[0].sha256 !== sha256) {
          throw new Error('Applied migration changed on disk: ' + file);
        }
        console.log('Already applied: ' + file);
        continue;
      }

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into public.app_schema_migrations (name, sha256) values ($1, $2)',
          [file, sha256],
        );
        await client.query('commit');
        console.log('Applied: ' + file);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [72149001]);
  }
} finally {
  await client.end();
}
