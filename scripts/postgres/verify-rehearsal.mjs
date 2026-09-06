import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.SOURCE_DATABASE_URL || !process.env.DATABASE_URL || !process.env.PGSSLROOTCERT) {
  throw new Error('SOURCE_DATABASE_URL, DATABASE_URL and PGSSLROOTCERT are required');
}

const sourceUrl = new URL(process.env.SOURCE_DATABASE_URL);
sourceUrl.searchParams.delete('sslmode');
sourceUrl.searchParams.delete('sslrootcert');
const ca = await readFile(process.env.PGSSLROOTCERT, 'utf8');
const source = new pg.Client({
  connectionString: sourceUrl.toString(),
  ssl: { ca, rejectUnauthorized: true },
});
const target = new pg.Client({ connectionString: process.env.DATABASE_URL });

function identifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function tables(client) {
  const result = await client.query(`
    select schemaname, tablename
    from pg_tables
    where schemaname = any($1::text[])
    order by schemaname, tablename
  `, [['public', 'auth']]);
  return result.rows;
}

async function fingerprint(client, table) {
  const qualified = `${identifier(table.schemaname)}.${identifier(table.tablename)}`;
  const result = await client.query(`
    select
      count(*)::text as rows,
      coalesce(md5(string_agg(row_hash, '' order by row_hash)), md5('')) as fingerprint
    from (
      select md5(to_jsonb(record)::text) as row_hash
      from ${qualified} as record
    ) rows
  `);
  return result.rows[0];
}

async function objectInventory(client) {
  const result = await client.query(`
    select 'function' as type, n.nspname as schema, p.proname as name,
           pg_get_function_identity_arguments(p.oid) as identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = any($1::text[])
    union all
    select 'trigger', n.nspname, t.tgname, c.relname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = any($1::text[])
    union all
    select 'policy', schemaname, policyname, tablename
    from pg_policies
    where schemaname = any($1::text[])
    union all
    select 'constraint', n.nspname, con.conname, c.relname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any($1::text[])
    order by 1, 2, 3, 4
  `, [['public', 'auth']]);
  return new Set(result.rows.map((row) => JSON.stringify(row)));
}

await Promise.all([source.connect(), target.connect()]);
try {
  await Promise.all([
    source.query("set timezone = 'UTC'"),
    target.query("set timezone = 'UTC'"),
  ]);
  const [sourceTables, targetTables] = await Promise.all([tables(source), tables(target)]);
  const sourceNames = new Set(sourceTables.map((table) => `${table.schemaname}.${table.tablename}`));
  const targetNames = new Set(targetTables.map((table) => `${table.schemaname}.${table.tablename}`));
  const missingTables = [...sourceNames].filter((name) => !targetNames.has(name));
  const extraTables = [...targetNames].filter((name) => !sourceNames.has(name));
  const contentMismatches = [];
  let totalRows = 0n;

  for (const table of sourceTables) {
    const name = `${table.schemaname}.${table.tablename}`;
    if (!targetNames.has(name)) continue;
    const [sourceFingerprint, targetFingerprint] = await Promise.all([
      fingerprint(source, table),
      fingerprint(target, table),
    ]);
    totalRows += BigInt(sourceFingerprint.rows);
    if (sourceFingerprint.rows !== targetFingerprint.rows
      || sourceFingerprint.fingerprint !== targetFingerprint.fingerprint) {
      contentMismatches.push(name);
    }
  }

  const [sourceObjects, targetObjects] = await Promise.all([
    objectInventory(source), objectInventory(target),
  ]);
  const missingObjects = [...sourceObjects].filter((item) => !targetObjects.has(item));
  const extraObjects = [...targetObjects].filter((item) => !sourceObjects.has(item));

  const report = {
    sourceTables: sourceTables.length,
    targetTables: targetTables.length,
    totalRows: totalRows.toString(),
    missingTables,
    extraTables,
    contentMismatches,
    sourceObjects: sourceObjects.size,
    targetObjects: targetObjects.size,
    missingObjectCount: missingObjects.length,
    extraObjectCount: extraObjects.length,
    missingObjects: missingObjects.slice(0, 20).map(JSON.parse),
    extraObjects: extraObjects.slice(0, 20).map(JSON.parse),
  };
  console.log(JSON.stringify(report, null, 2));
  if (missingTables.length || extraTables.length || contentMismatches.length || missingObjects.length) {
    process.exitCode = 1;
  }
} finally {
  await Promise.allSettled([source.end(), target.end()]);
}
