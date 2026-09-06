import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { hashPassword } from 'better-auth/crypto';
import { hash } from 'bcryptjs';
import { makeAuthOptions } from '../../src/lib/postgres/auth-options.mjs';
import { armaRpcQuery } from '../../src/lib/postgres/arma-rpc.mjs';

function run(file, args, env = process.env) {
  return new Promise((resolve, reject) => {
    // PostgreSQL children on Windows can inherit pipes and prevent execFile closing.
    const child = spawn(file, args, { stdio: 'ignore', windowsHide: true, env });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(file)} failed (${code})`)));
  });
}
const bin = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/16/bin';
const dir = await mkdtemp(path.join(tmpdir(), 'roster-pg-test-'));
const data = path.join(dir, 'data');
let started = false;
let pool;
try {
  const port = await new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
  // Temporary loopback-only database contains test fixtures, never copied user data.
  await run(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale']);
  await run(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start']);
  started = true;
  pool = new Pool({ connectionString: `postgres://postgres@127.0.0.1:${port}/postgres`, connectionTimeoutMillis: 5000 });
  const options = makeAuthOptions(pool, {
    APP_ORIGIN: 'http://localhost:3000', NATIVE_AUTH_SECRET: 'integration-test-secret-not-for-deployment', NODE_ENV: 'test',
  });
  const plan = await getMigrations(options);
  await plan.runMigrations();
  const secondPlan = await getMigrations(options);
  assert.equal(secondPlan.toBeCreated.length, 0);
  assert.equal(secondPlan.toBeAdded.length, 0);
  await pool.query(`create function public.record_arma_xp_event(
    p_event_uid text, p_event_type text, p_steam_id text, p_xp_delta integer,
    p_server_id text, p_mission_id text, p_occurred_at timestamptz,
    p_target_category text, p_target_class text, p_target_display_name text)
    returns table (target_display_name text, week_start_date date, xp_delta integer)
    language sql as $$ select p_target_display_name, p_occurred_at::date, p_xp_delta $$`);
  const targetName = "Droid'); DROP TABLE app_auth_users; --";
  const rpc = await pool.query(armaRpcQuery('record_arma_xp_event', {
    p_event_uid: 'test-1', p_event_type: 'KILL', p_steam_id: '76561198192344539', p_xp_delta: 10,
    p_server_id: 'test', p_mission_id: 'test', p_occurred_at: '2026-09-05T10:00:00Z',
    p_target_category: 'INFANTRY', p_target_class: 'test_class', p_target_display_name: targetName,
  }));
  assert.deepEqual(rpc.rows[0].value, { target_display_name: targetName, week_start_date: '2026-09-05', xp_delta: 10 });
  const id = randomUUID();
  const password = 'integration-test-password-123';
  await pool.query(`insert into app_auth_users (id,name,email,"emailVerified","createdAt","updatedAt",username,"displayUsername",disabled)
    values ($1,'Test','test@example.invalid',true,now(),now(),'testuser','testuser',false)`, [id]);
  await pool.query(`insert into app_auth_accounts
    (id,"userId","accountId","providerId",issuer,password,"createdAt","updatedAt")
    values ($1,$2::uuid,$2::text,'credential','local:credential',$3,now(),now())`, [randomUUID(), id, await hashPassword(password)]);
  const auth = betterAuth(options);
  function request(endpoint, body) {
    return auth.handler(new Request(`http://localhost:3000/api/native-auth/${endpoint}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '127.0.0.1' }, body: JSON.stringify(body),
    }));
  }
  assert.equal((await request('sign-in/username', { username: 'testuser', password: 'incorrect' })).status, 401);
  const login = await request('sign-in/username', { username: 'testuser', password });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  const session = await pool.query('select "userId" from app_auth_sessions');
  assert.equal(session.rows[0].userId, id);
  assert.notEqual((await request('sign-up/email', { email: 'other@example.invalid', name: 'Other', password })).status, 200);
  await pool.query('update app_auth_users set disabled = true where id = $1', [id]);
  assert.notEqual((await request('sign-in/username', { username: 'testuser', password })).status, 200);
  await pool.query('create database source_fixture');
  const sourceUrl = `postgres://postgres@127.0.0.1:${port}/source_fixture`;
  const source = new Pool({ connectionString: sourceUrl });
  const importedId = randomUUID();
  try {
    await source.query(`create schema auth;
      create table auth.users (id uuid primary key, email text, encrypted_password text,
        email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
        banned_until timestamptz, deleted_at timestamptz)`);
    await source.query(`insert into auth.users (id,email,encrypted_password,email_confirmed_at,created_at,updated_at)
      values ($1,'imported@example.invalid',$2,now(),now(),now())`, [importedId, await hash(password, 10)]);
    const mapping = path.join(dir, 'mapping.json');
    await writeFile(mapping, JSON.stringify({ [importedId]: 'imported' }));
    const env = { ...process.env, SOURCE_DATABASE_URL: sourceUrl,
      DATABASE_URL: `postgres://postgres@127.0.0.1:${port}/postgres`,
      NATIVE_MIGRATION_DATABASE: 'postgres', NODE_ENV: 'test' };
    const args = ['scripts/postgres/import-auth.mjs', '--mapping', mapping];
    await run(process.execPath, args, env);
    assert.equal((await pool.query('select id from app_auth_users where id = $1', [importedId])).rowCount, 0);
    await run(process.execPath, [...args, '--apply'], env);
    assert.equal((await pool.query('select id from app_auth_users where id = $1', [importedId])).rows[0].id, importedId);
    assert.equal((await request('sign-in/username', { username: 'imported', password })).status, 200);
    await assert.rejects(run(process.execPath, [...args, '--apply'], env));
    assert.equal((await pool.query('select id from app_auth_users')).rowCount, 2);
    assert.equal((await source.query('select id from auth.users')).rowCount, 1);
    await request('sign-in/username', { username: 'imported', password: 'incorrect' });
    assert.equal((await request('sign-in/username', { username: 'imported', password })).status, 429);
  } finally { await source.end(); }
  console.log('PASS: parameterized Arma RPC/date serialization, schema replay, username login, invalid credentials, HttpOnly session, UUID preservation, signup disabled, disabled-account login, account import preview/apply/replay protection, bcrypt login, rate limiting.');
} finally {
  if (pool) await pool.end();
  if (started) await run(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-m', 'fast', '-w', 'stop']);
  // Only the exact directory returned by mkdtemp above is removed.
  if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('roster-pg-test-')) {
    throw new Error('Refusing cleanup outside the temporary test directory');
  }
  await rm(dir, { recursive: true, force: true });
}
