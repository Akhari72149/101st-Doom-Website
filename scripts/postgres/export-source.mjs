import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportConfig, requirePg17Version } from './export-config.mjs';

if (process.argv.includes('--help')) {
  console.log('Read-only source export. Required private env: SOURCE_DATABASE_URL, PG17_BIN, POSTGRES_BACKUP_DIRECTORY. No server install or restore is performed.');
  process.exit(0);
}

const run = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let output;
let config;

function sanitizeDiagnostic(error) {
  const raw = [error?.stderr, error?.message]
    .filter(Boolean)
    .join('\n')
    .replaceAll(process.env.SOURCE_DATABASE_URL || '', '[REDACTED_CONNECTION_URL]')
    .replaceAll(config?.connection?.PGPASSWORD || '', '[REDACTED_PASSWORD]');

  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_CONNECTION_URL]')
    .trim()
    .slice(0, 8000);
}

try {
  config = exportConfig(process.env, repository);
  for (const binary of [config.pgDump, config.pgRestore]) {
    const { stdout } = await run(binary, ['--version'], { windowsHide: true });
    requirePg17Version(stdout);
  }
  await mkdir(config.directory, { recursive: true });
  output = await mkdtemp(path.join(config.directory, 'roster-source-'));
  const partial = path.join(output, 'source.dump.partial');
  const env = { ...process.env, ...config.connection };
  const { stderr } = await run(config.pgDump, [
    '--no-password', '--format=custom', '--lock-wait-timeout=15000', `--file=${partial}`,
  ], { env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const { stdout: contents } = await run(config.pgRestore, ['--list', partial], {
    windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  });
  if (!contents.includes('TABLE DATA')) throw new Error('Archive has no table data');
  await writeFile(path.join(output, 'contents.txt'), contents, { flag: 'wx' });
  if (stderr.trim()) await writeFile(path.join(output, 'export-warnings.txt'), stderr, { flag: 'wx' });
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(partial)) digest.update(chunk);
  await rename(partial, path.join(output, 'source.dump'));
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(), sha256: digest.digest('hex'),
    archive: 'source.dump', hasWarnings: !!stderr.trim(), targetMajorVersion: 16,
    status: 'exported-not-restored-or-verified',
    separateExportsRequired: ['Edge Function source and secrets', 'cron definitions and service configuration', 'role definitions and grants review'],
  }, null, 2), { flag: 'wx' });
  console.log(`Source archive created in ${output}`);
  console.log('Review warnings and separately archive Edge Functions, cron and service settings. No restore was performed.');
} catch (error) {
  const diagnostic = sanitizeDiagnostic(error);
  console.error('Source export failed:', error.code || (error.cmd ? 'EXPORT_COMMAND_FAILED' : error.message));
  if (output) {
    if (diagnostic) {
      await writeFile(path.join(output, 'export-error.txt'), diagnostic, { flag: 'wx' });
    }
    console.error(`Incomplete export retained at ${output}; do not use it as a verified backup.`);
    if (diagnostic) console.error(diagnostic);
  }
  process.exitCode = 1;
}
