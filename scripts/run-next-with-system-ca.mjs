import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const env = { ...process.env, NODE_USE_SYSTEM_CA: '1' };
const nodeOptions = String(env.NODE_OPTIONS || '')
  .split(/\s+/)
  .filter((option) => option && option !== '--use-system-ca')
  .join(' ');
if (nodeOptions) env.NODE_OPTIONS = nodeOptions;
else delete env.NODE_OPTIONS;

const child = spawn(process.execPath, [next, ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
