import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresConfig, nativeAuthConfig } from '../../src/lib/postgres/config.mjs';
import { verifyMigratedPassword } from '../../src/lib/postgres/auth-options.mjs';
import { hashPassword } from 'better-auth/crypto';
import { hash } from 'bcryptjs';
import { armaRpcQuery } from '../../src/lib/postgres/arma-rpc.mjs';
import { exportConfig, requirePg17Version } from './export-config.mjs';
import { assertTarget } from './target-guard.mjs';
import path from 'node:path';

test('source exports reject old clients, unsafe output locations and insecure TLS', () => {
  const repository = path.resolve('test-repository');
  const env = {
    SOURCE_DATABASE_URL: 'postgresql://test:private%40password@example.invalid:5432/postgres',
    PG17_BIN: path.resolve('test-pg17-bin'), POSTGRES_BACKUP_DIRECTORY: path.resolve('test-backups'),
  };
  const config = exportConfig(env, repository);
  assert.equal(config.connection.PGPASSWORD, 'private@password');
  assert.equal(config.connection.PGSSLMODE, 'verify-full');
  assert.match(config.connection.PGOPTIONS, /read_only=on/);
  assert.throws(() => requirePg17Version('pg_dump (PostgreSQL) 16.14'), /version 17/);
  requirePg17Version('pg_dump (PostgreSQL) 17.6');
  for (const directory of [repository, path.join(repository, 'backups')]) {
    assert.throws(() => exportConfig({ ...env, POSTGRES_BACKUP_DIRECTORY: directory }, repository), /outside/);
  }
  assert.throws(() => exportConfig({ ...env, SOURCE_DATABASE_URL: env.SOURCE_DATABASE_URL + '?sslmode=disable' }, repository), /sslmode/);
  assert.throws(() => exportConfig({ ...env, SOURCE_DATABASE_URL: env.SOURCE_DATABASE_URL + '?options=arbitrary' }, repository), /Unsupported/);
});

test('Arma SQL rejects arbitrary functions and parameters', () => {
  assert.throws(() => armaRpcQuery('pg_sleep', {}), /Unsupported/);
  assert.throws(() => armaRpcQuery('constructor', {}), /Unsupported/);
  assert.throws(() => armaRpcQuery('reset_arma_xp_weekly_data', { injected: '1' }), /parameters/);
  assert.throws(() => armaRpcQuery('record_arma_xp_event', {}), /parameters/);
  assert.deepEqual(armaRpcQuery('reset_arma_xp_weekly_data').values, []);
});

test('database configuration fails without an explicit destination', () => {
  assert.throws(() => postgresConfig({}), /DATABASE_URL/);
  assert.throws(() => postgresConfig({ DATABASE_URL: 'https://example.com' }), /PostgreSQL/);
  assert.throws(() => postgresConfig({ DATABASE_URL: 'postgres://localhost/test', DATABASE_POOL_MAX: '0' }), /POOL/);
  assert.equal(postgresConfig({ DATABASE_URL: 'postgres://localhost/test' }).max, 10);
});

test('cutover targets require two matching database declarations', () => {
  const base = {
    DATABASE_URL: 'postgresql://owner:secret@127.0.0.1:5432/roster_production',
    NATIVE_MIGRATION_DATABASE: 'roster_production',
  };
  assert.throws(() => assertTarget({ argv: ['node'], env: base, purpose: 'test' }), /roster_native_/);
  assert.throws(() => assertTarget({ argv: ['node', '--cutover'], env: base, purpose: 'test' }), /CUTOVER_CONFIRM_DATABASE/);
  assert.deepEqual(
    assertTarget({
      argv: ['node', '--cutover'],
      env: { ...base, CUTOVER_CONFIRM_DATABASE: 'roster_production' },
      purpose: 'test',
    }).database,
    'roster_production',
  );
  assert.throws(() => assertTarget({
    argv: ['node', '--cutover'],
    env: {
      ...base,
      DATABASE_URL: 'postgresql://owner:secret@127.0.0.1:5432/postgres',
      NATIVE_MIGRATION_DATABASE: 'postgres',
      CUTOVER_CONFIRM_DATABASE: 'postgres',
    },
    purpose: 'test',
  }), /maintenance/);
});

test('production requires HTTPS and an explicit origin and secret', () => {
  const env = { NATIVE_AUTH_SECRET: 'a'.repeat(32), APP_ORIGIN: 'http://localhost:3000', NODE_ENV: 'production' };
  assert.throws(() => nativeAuthConfig(env), /HTTPS/);
  assert.throws(() => nativeAuthConfig({ ...env, APP_ORIGIN: 'https://example.com/path' }), /APP_ORIGIN/);
  assert.throws(() => nativeAuthConfig({ ...env, APP_ORIGIN: 'https://example.com', NATIVE_AUTH_SECRET: '' }), /SECRET/);
  assert.equal(nativeAuthConfig({ ...env, NODE_ENV: 'development' }).origin, 'http://localhost:3000');
  assert.equal(nativeAuthConfig({
    ...env,
    NATIVE_AUTH_ALLOW_INSECURE_LOOPBACK: 'true',
  }).origin, 'http://localhost:3000');
  assert.throws(() => nativeAuthConfig({
    ...env,
    APP_ORIGIN: 'http://example.com',
    NATIVE_AUTH_ALLOW_INSECURE_LOOPBACK: 'true',
  }), /HTTPS/);
});

test('legacy bcrypt and new scrypt passwords reject incorrect credentials', async () => {
  const password = 'a-test-only-password-123';
  for (const digest of [await hash(password, 10), await hashPassword(password)]) {
    assert.equal(await verifyMigratedPassword({ hash: digest, password }), true);
    assert.equal(await verifyMigratedPassword({ hash: digest, password: 'wrong' }), false);
  }
});
