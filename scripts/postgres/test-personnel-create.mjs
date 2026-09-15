import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.NATIVE_MIGRATION_DATABASE !== 'roster_native_rehearsal') {
  throw new Error('This rollback-only test requires roster_native_rehearsal');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function createPersonnel({ importFromDiscord }) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const discordId = `90000000${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`;
  const processor = await client.query(`
    select pc.personnel_id
    from public.personnel_certifications pc
    join public.personnel p on p.id = pc.personnel_id
    where pc.certification_id = any($1::uuid[])
      and lower(coalesce(p.status, '')) not in ('removed', 'retired', 'transferred')
    limit 1
  `, [[
    '079827bf-8b8f-4f37-9b6c-664942689a0a',
    'c579ef59-7010-4bcc-bcd4-9cd448ac5bf5',
    '8eff73b9-9793-452a-b77d-c16cde5b9b4c',
  ]]);
  const user = await client.query(`
    select user_id from public.audit_logs
    where user_id is not null
    limit 1
  `);
  const rank = await client.query('select id from public.ranks order by rank_level limit 1');
  assert.ok(processor.rows[0]?.personnel_id, 'No certified processor found');
  assert.ok(user.rows[0]?.user_id, 'No audit user found');
  assert.ok(rank.rows[0]?.id, 'No rank found');

  const inserted = await client.query(`
    insert into public.personnel(
      rank_id, birth_number, name, discord_id, ts_id,
      auto_role_sync, status, created_at
    ) values($1, $2, $3, $4, null, $5, null, now())
    returning id
  `, [
    importFromDiscord ? null : rank.rows[0].id,
    `TEST-${suffix}`,
    `Native Create Test ${suffix}`,
    discordId,
    !importFromDiscord,
  ]);
  const personnelId = inserted.rows[0].id;

  await client.query(`
    insert into public.audit_logs(
      user_id, target_personnel_id, action, details, processed_by
    ) values($1, $2, 'NEW_MEMBER', 'Rollback-only create test', $3)
  `, [user.rows[0].user_id, personnelId, processor.rows[0].personnel_id]);

  if (importFromDiscord) {
    await client.query('select public.enqueue_personnel_discord_import($1)', [personnelId]);
  }

  const event = await client.query(`
    select event_type
    from public.discord_role_outbox
    where payload->>'personnelId' = $1
       or ($2::text is not null and payload->>'discordId' = $2)
    order by created_at desc
    limit 1
  `, [personnelId, discordId]);
  const expectedEvent = importFromDiscord
    ? 'USER_FULL_IMPORT'
    : 'USER_ROLE_INIT';
  assert.equal(event.rows[0]?.event_type, expectedEvent);
}

try {
  await client.connect();
  await client.query('begin');
  await createPersonnel({ importFromDiscord: false });
  await createPersonnel({ importFromDiscord: true });
  await client.query('rollback');
  console.log('PASS: linked and Discord-import personnel creation succeeded and were rolled back.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
