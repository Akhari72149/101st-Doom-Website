import pg from 'pg';
import { assertTarget } from './target-guard.mjs';

const { database, cutover } = assertTarget({ purpose: 'database creation' });
if (!process.env.POSTGRES_ADMIN_URL) throw new Error('POSTGRES_ADMIN_URL is required');

const client = new pg.Client({ connectionString: process.env.POSTGRES_ADMIN_URL });
try {
  await client.connect();
  const existing = await client.query('select 1 from pg_database where datname = $1', [database]);
  if (existing.rowCount) {
    throw new Error(`Database ${database} already exists; refusing to overwrite it`);
  }

  const identifier = `"${database.replaceAll('"', '""')}"`;
  await client.query(`create database ${identifier} with template template0 encoding 'UTF8'`);
  console.log(`Created ${cutover ? 'cutover' : 'isolated rehearsal'} PostgreSQL database: ${database}`);
} finally {
  await client.end();
}
