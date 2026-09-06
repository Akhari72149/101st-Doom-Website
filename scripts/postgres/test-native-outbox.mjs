import assert from 'node:assert/strict';
import pg from 'pg';

if (!process.env.DATABASE_URL || process.env.NATIVE_MIGRATION_DATABASE !== 'roster_native_rehearsal') {
  throw new Error('This rollback-only test requires roster_native_rehearsal');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query('begin');

  const legacy = await client.query(
    "select to_regprocedure('public.verify_admin_password(text)') admin, " +
    "to_regprocedure('public.verify_page_password(text)') page",
  );
  assert.equal(legacy.rows[0].admin, null);
  assert.equal(legacy.rows[0].page, null);

  const definitions = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any($1::text[])
  `, [[
    'notify_cert_change',
    'notify_user_created',
    'sync_personnel_discord_tags',
  ]]);
  assert.equal(definitions.rowCount, 3);
  for (const row of definitions.rows) {
    assert.match(row.definition, /discord_role_outbox/);
    assert.doesNotMatch(row.definition, /net\.http_post/);
  }

  const certification = await client.query(`
    select pc.personnel_id, pc.certification_id, p.discord_id, c.cert_id
    from public.personnel_certifications pc
    join public.personnel p on p.id = pc.personnel_id
    join public.certifications c on c.id = pc.certification_id
    where nullif(btrim(p.discord_id), '') is not null
      and nullif(btrim(c.cert_id), '') is not null
    limit 1
  `);
  assert.equal(certification.rowCount, 1);
  const cert = certification.rows[0];
  await client.query(
    'delete from public.personnel_certifications where personnel_id = $1 and certification_id = $2',
    [cert.personnel_id, cert.certification_id],
  );
  const certEvent = await client.query(`
    select event_type, payload
    from public.discord_role_outbox
    where event_type = 'CERT_ROLE_SYNC'
    order by created_at desc
    limit 1
  `);
  assert.equal(certEvent.rows[0].event_type, 'CERT_ROLE_SYNC');
  assert.deepEqual(certEvent.rows[0].payload, {
    discordId: cert.discord_id,
    roleId: cert.cert_id,
    action: 'revoke',
  });

  const personnel = await client.query(`
    select id, discord_id
    from public.personnel
    where nullif(btrim(discord_id), '') is not null
      and lower(coalesce(status, '')) not in ('removed', 'retired')
    limit 1
  `);
  assert.equal(personnel.rowCount, 1);
  await client.query(
    "update public.personnel set status = 'Retired' where id = $1",
    [personnel.rows[0].id],
  );
  const statusEvent = await client.query(`
    select event_type, payload
    from public.discord_role_outbox
    where event_type = 'PERSONNEL_STATUS_SYNC'
    order by created_at desc
    limit 1
  `);
  assert.equal(statusEvent.rows[0].event_type, 'PERSONNEL_STATUS_SYNC');
  assert.deepEqual(statusEvent.rows[0].payload, {
    personnelId: personnel.rows[0].id,
    discordId: personnel.rows[0].discord_id,
    status: 'retired',
  });

  await client.query('rollback');
  console.log('PASS: native Discord outbox migrations, trigger payloads and legacy password removal.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
