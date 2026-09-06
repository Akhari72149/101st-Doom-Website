import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { hostedSourceConfig } from './hosted-source.mjs';

const directory = path.resolve('.migration-private');
const mappingPath = path.join(directory, 'native-usernames.json');
const reviewPath = path.join(directory, 'native-username-review.json');
const overwrite = process.argv.includes('--force');

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 40);
}

function uniqueUsername(preferred, used) {
  let base = normalizeUsername(preferred) || 'member';
  if (base.length < 3) base = `${base}_user`.slice(0, 40);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const ending = `_${suffix++}`;
    candidate = `${base.slice(0, 40 - ending.length)}${ending}`;
  }
  used.add(candidate);
  return candidate;
}

await mkdir(directory, { recursive: true });
if (!overwrite) {
  for (const outputPath of [mappingPath, reviewPath]) {
    const exists = await access(outputPath).then(() => true).catch(() => false);
    if (exists) throw new Error('Private username files already exist; review them or pass --force to regenerate');
  }
}

const source = new pg.Client(await hostedSourceConfig());
try {
  await source.connect();
  const { rows } = await source.query(`
    select u.id,
           u.email,
           u.encrypted_password,
           coalesce(nullif(btrim(pe.name), ''), nullif(btrim(p.display_name), ''), '') as display_name
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join lateral (
        select personnel.name
          from public.personnel
         where personnel.auth_user_id = u.id
         order by personnel.created_at
         limit 1
      ) pe on true
     where u.deleted_at is null
     order by lower(coalesce(pe.name, p.display_name, u.email)), u.id
  `);

  const unsupported = rows.filter((row) =>
    !row.email || !/^\$2[aby]\$\d{2}\$/.test(row.encrypted_password || ''),
  );
  if (unsupported.length) {
    throw new Error(`${unsupported.length} active account(s) need a separately reviewed credential migration`);
  }

  const used = new Set();
  const mapping = {};
  const review = [];
  for (const row of rows) {
    const emailPrefix = String(row.email).split('@')[0];
    const username = uniqueUsername(row.display_name || emailPrefix, used);
    mapping[row.id] = username;
    review.push({ displayName: row.display_name || username, username });
  }

  await writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
  console.log(`Prepared ${rows.length} active account username(s).`);
  for (const entry of review) console.log(`- ${entry.displayName}: ${entry.username}`);
  console.log(`Private mapping: ${mappingPath}`);
  console.log(`Private review: ${reviewPath}`);
} finally {
  await source.end();
}
