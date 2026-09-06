import { randomBytes } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const envPath = path.resolve('.env.postgres-target.local');
const source = await readFile(envPath, 'utf8');
const additions = [];

if (!/^APP_ORIGIN=/m.test(source)) additions.push('APP_ORIGIN=http://localhost:3000');
if (!/^NATIVE_AUTH_SECRET=/m.test(source)) {
  additions.push(`NATIVE_AUTH_SECRET=${randomBytes(48).toString('base64url')}`);
}

if (additions.length) {
  const separator = source.endsWith('\n') ? '' : '\n';
  await appendFile(envPath, `${separator}${additions.join('\n')}\n`, 'utf8');
}

console.log(additions.length
  ? `Added ${additions.map((line) => line.split('=')[0]).join(' and ')} to the private target environment.`
  : 'Native authentication environment is already configured.');
