import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { assertTarget } from '../postgres/target-guard.mjs';

const exec = promisify(execFile);
const SHA = /^[0-9a-f]{40}$/;
const enabled = process.env.WEBSITE_UPDATE_EXECUTION_ENABLED === 'true';
if (!enabled) throw new Error('WEBSITE_UPDATE_EXECUTION_ENABLED must be true');
const { database } = assertTarget({ purpose: 'website update worker' });
if (!process.argv.includes('--cutover')) throw new Error('Run production updates through updater:run');

const root = path.resolve(process.env.WEBSITE_ROOT || '');
const websiteTask = process.env.WEBSITE_TASK_NAME;
const backupEnv = path.resolve(process.env.POSTGRES_BACKUP_ENV_FILE || '');
const healthUrl = process.env.WEBSITE_HEALTH_URL || 'http://127.0.0.1:3000/api/site-version';
const npmCli = path.resolve(process.env.NPM_CLI || path.join(
  path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js',
));
if (!path.isAbsolute(process.env.WEBSITE_ROOT || '')) throw new Error('WEBSITE_ROOT must be absolute');
if (!websiteTask || !process.env.POSTGRES_BACKUP_ENV_FILE) {
  throw new Error('WEBSITE_TASK_NAME and POSTGRES_BACKUP_ENV_FILE are required');
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const output = [];
let job = null;
let websiteStopped = false;

function append(stage, text) {
  const clean = String(text || '').trim();
  if (clean) output.push(`[${stage}]\n${clean.slice(-6000)}`);
}

async function command(stage, file, args, options = {}) {
  const result = await exec(file, args, {
    cwd: root,
    windowsHide: true,
    timeout: options.timeout || 10 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
    env: options.env || process.env,
  });
  append(stage, result.stdout);
  append(stage, result.stderr);
  return result;
}

async function updateJob(status, stage, message, completed = false) {
  if (!job) return;
  await client.query(`update public.website_update_jobs set status=$2,stage=$3,message=$4,
      output=$5,updated_at=now(),completed_at=case when $6 then now() else completed_at end
    where id=$1`, [job.id, status, stage, message, output.join('\n\n').slice(-20_000), completed]);
}

async function startWebsite() {
  await command('restart', 'schtasks.exe', ['/Run', '/TN', websiteTask], { timeout: 30_000 });
  websiteStopped = false;
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('Website did not pass its health check within 60 seconds');
}

await client.connect();
try {
  const claimed = await client.query(`with candidate as (
      select id from public.website_update_jobs where status='pending'
      order by requested_at for update skip locked limit 1
    )
    update public.website_update_jobs jobs
    set status='running',stage='preflight',message='Update worker claimed the request',
        started_at=now(),updated_at=now()
    from candidate where jobs.id=candidate.id
    returning jobs.*`);
  job = claimed.rows[0] || null;
  if (!job) {
    console.log(`No pending website update for ${database}.`);
  } else {
    if (!SHA.test(job.from_commit) || !SHA.test(job.target_commit)) {
      throw new Error('Queued update contains an invalid commit identifier');
    }

    const { stdout: status } = await command('preflight', 'git', ['status', '--porcelain', '--untracked-files=no']);
    if (status.trim()) throw new Error('Website Git working tree is not clean');
    const { stdout: current } = await command('preflight', 'git', ['rev-parse', 'HEAD']);
    if (current.trim().toLowerCase() !== job.from_commit) {
      throw new Error('Installed commit changed after the update was approved');
    }
    await command('fetch', 'git', ['-c', 'gc.auto=0', 'fetch', '--prune', 'origin', 'main']);
    const { stdout: target } = await command('fetch', 'git', ['rev-parse', 'origin/main']);
    if (target.trim().toLowerCase() !== job.target_commit) {
      throw new Error('origin/main changed after approval; check again and submit a new update');
    }
    await command('preflight', 'git', ['merge-base', '--is-ancestor', job.from_commit, job.target_commit]);

    await updateJob('running', 'stopping', 'Stopping the website before backup');
    await command('stop', 'schtasks.exe', ['/End', '/TN', websiteTask], { timeout: 30_000 });
    websiteStopped = true;

    await updateJob('running', 'backup', 'Creating and verifying the pre-update database backup');
    const backupChildEnv = { ...process.env };
    for (const name of ['DATABASE_URL', 'NATIVE_MIGRATION_DATABASE', 'CUTOVER_CONFIRM_DATABASE']) {
      delete backupChildEnv[name];
    }
    await command('backup', process.execPath, [
      `--env-file=${backupEnv}`,
      path.join(root, 'scripts/postgres/backup-native.mjs'),
    ], { env: backupChildEnv });

    await updateJob('running', 'installing', 'Installing the approved source and dependencies');
    await command('git', 'git', ['merge', '--ff-only', job.target_commit]);
    await command('dependencies', process.execPath, [npmCli, 'ci'], { timeout: 15 * 60_000 });

    await updateJob('running', 'migrating', 'Applying checksum-locked database migrations');
    await command('migrations', process.execPath, [
      path.join(root, 'scripts/postgres/apply-native-migrations.mjs'),
      '--cutover',
    ]);

    await updateJob('running', 'building', 'Creating the production website build');
    const buildEnv = { ...process.env };
    for (const name of [
      'DATABASE_URL', 'POSTGRES_ADMIN_URL', 'NATIVE_MIGRATION_DATABASE',
      'CUTOVER_CONFIRM_DATABASE', 'POSTGRES_SOURCE_ARCHIVE',
      'POSTGRES_RUNTIME_ENV_FILE', 'POSTGRES_SCHEDULER_ENV_FILE',
      'POSTGRES_BACKUP_ENV_FILE', 'POSTGRES_BACKUP_DIRECTORY',
    ]) delete buildEnv[name];
    await command('build', process.execPath, [npmCli, 'run', 'build'], {
      env: buildEnv,
      timeout: 20 * 60_000,
    });

    await updateJob('running', 'restarting', 'Starting the updated website');
    await startWebsite();
    await waitForHealth();
    await updateJob('succeeded', 'complete', `Website updated to ${job.target_commit.slice(0, 7)}`, true);
    console.log(`Website update completed: ${job.target_commit.slice(0, 7)}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  append('failure', message);
  await updateJob('failed', 'failed', message.slice(0, 1000), true).catch(() => {});
  if (websiteStopped) await startWebsite().catch((restartError) => append('restart-failure', restartError));
  console.error(`Website update failed: ${message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
