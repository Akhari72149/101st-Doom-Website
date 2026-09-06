import { spawn } from 'node:child_process';
import path from 'node:path';

const database = process.env.NATIVE_MIGRATION_DATABASE;
if (!process.env.DATABASE_URL || !database) {
  throw new Error('DATABASE_URL and NATIVE_MIGRATION_DATABASE are required');
}
const target = new URL(process.env.DATABASE_URL);
if (target.pathname.slice(1) !== database || !/^roster_native_[a-z0-9_]+$/.test(database)) {
  throw new Error('Native auth rehearsal must target a guarded roster_native_ database');
}

const next = path.resolve('node_modules/next/dist/bin/next');
const args = process.argv.slice(2);
const child = spawn(process.execPath, [next, 'dev', ...args], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    NATIVE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_AUTH_BACKEND: 'native',
    SERVER_BOOKINGS_BACKEND: 'postgres',
    ROSTER_DATABASE_BACKEND: 'postgres',
    PERSONNEL_DATABASE_BACKEND: 'postgres',
    ARMA_DATABASE_BACKEND: 'postgres',
    ORBAT_DATABASE_BACKEND: 'postgres',
    HOME_DATABASE_BACKEND: 'postgres',
    ATTENDANCE_DATABASE_BACKEND: 'postgres',
    AUDIT_DATABASE_BACKEND: 'postgres',
    LOOKUP_DATABASE_BACKEND: 'postgres',
    TASKBOARD_DATABASE_BACKEND: 'postgres',
    MOD_TASKBOARD_DATABASE_BACKEND: 'postgres',
    RANDOMISER_DATABASE_BACKEND: 'postgres',
    LOGISTICS_DATABASE_BACKEND: 'postgres',
    PLANOPS_DATABASE_BACKEND: 'postgres',
    ADMIN_PERSONNEL_DATABASE_BACKEND: 'postgres',
    DISCORD_DATABASE_BACKEND: 'postgres',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 1));
