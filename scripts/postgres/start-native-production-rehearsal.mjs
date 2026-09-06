import { spawn } from 'node:child_process';
import path from 'node:path';

const database = process.env.NATIVE_MIGRATION_DATABASE;
if (!process.env.DATABASE_URL || !database) {
  throw new Error('DATABASE_URL and NATIVE_MIGRATION_DATABASE are required');
}
const target = new URL(process.env.DATABASE_URL);
if (target.pathname.slice(1) !== database || !/^roster_native_[a-z0-9_]+$/.test(database)) {
  throw new Error('Production rehearsal must target a guarded roster_native_ database');
}
const args = process.argv.slice(2);
if (args.some((value) => value === '-H' || value === '--hostname')) {
  throw new Error('The production rehearsal hostname is fixed to 127.0.0.1');
}

const backendEnvironment = Object.fromEntries([
  'SERVER_BOOKINGS_BACKEND', 'ROSTER_DATABASE_BACKEND', 'PERSONNEL_DATABASE_BACKEND',
  'ARMA_DATABASE_BACKEND', 'ORBAT_DATABASE_BACKEND', 'HOME_DATABASE_BACKEND',
  'ATTENDANCE_DATABASE_BACKEND', 'AUDIT_DATABASE_BACKEND', 'LOOKUP_DATABASE_BACKEND',
  'TASKBOARD_DATABASE_BACKEND', 'ADMIN_PERSONNEL_DATABASE_BACKEND',
  'MOD_TASKBOARD_DATABASE_BACKEND', 'RANDOMISER_DATABASE_BACKEND',
  'LOGISTICS_DATABASE_BACKEND', 'PLANOPS_DATABASE_BACKEND', 'DISCORD_DATABASE_BACKEND',
].map((name) => [name, 'postgres']));

const next = path.resolve('node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', ...args], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    ...backendEnvironment,
    NODE_ENV: 'production',
    NATIVE_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_AUTH_BACKEND: 'native',
    NATIVE_AUTH_ALLOW_INSECURE_LOOPBACK: 'true',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
