import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
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
let maintenanceServer = null;
let publicJobStatus = null;

const stageProgress = {
  queued: 2, countdown: 5, preflight: 10, fetch: 16, backup: 28,
  stopping: 38, maintenance: 42, installing: 48, git: 52,
  dependencies: 60, migrating: 70, migrations: 74, building: 82,
  build: 88, restarting: 96, complete: 100, failed: 100,
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function append(stage, text) {
  const clean = String(text || '').trim();
  if (clean) output.push(`[${stage}]\n${clean.slice(-6000)}`);
}

async function command(stage, file, args, options = {}) {
  const startedAt = Date.now();
  const heartbeat = options.progressMessage
    ? setInterval(() => {
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        void updateJob(
          'running',
          stage,
          `${options.progressMessage} (${elapsedSeconds}s elapsed)`,
        ).catch((error) => append('heartbeat', error));
      }, 10_000)
    : null;
  heartbeat?.unref();

  try {
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
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function updateJob(status, stage, message, completed = false) {
  if (!job) return;
  const now = new Date().toISOString();
  publicJobStatus = {
    id: job.id,
    status,
    stage,
    message,
    progress: status === 'succeeded' || status === 'failed' ? 100 : (stageProgress[stage] || 5),
    requestedAt: new Date(job.requested_at).toISOString(),
    updatedAt: now,
    completedAt: completed ? now : null,
  };
  await client.query(`update public.website_update_jobs set status=$2,stage=$3,message=$4,
      output=$5,updated_at=now(),completed_at=case when $6 then now() else completed_at end
    where id=$1`, [job.id, status, stage, message, output.join('\n\n').slice(-20_000), completed]);
}

function publicStatusPayload() {
  return {
    active: Boolean(publicJobStatus && ['pending', 'running'].includes(publicJobStatus.status)),
    job: publicJobStatus,
    serverTime: new Date().toISOString(),
  };
}

function maintenanceDocument() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>101st Doom Battalion | Updating</title>
<style>
html{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#020806;color:#fff;font-family:Arial,sans-serif;background-image:linear-gradient(rgba(0,255,102,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,102,.035) 1px,transparent 1px);background-size:44px 44px}.panel{width:min(620px,100%);border:1px solid rgba(0,255,102,.3);background:rgba(0,8,5,.96);padding:32px;box-shadow:0 0 55px rgba(0,255,102,.09)}.eyebrow{color:#79a08a;font-size:12px;letter-spacing:.2em;text-transform:uppercase}.title{margin:12px 0 8px;color:#00ff66;font-size:clamp(25px,5vw,38px);letter-spacing:.08em;text-transform:uppercase}.message{color:#c5d2ca;line-height:1.65}.bar{height:8px;margin-top:28px;background:rgba(255,255,255,.1);overflow:hidden}.fill{height:100%;width:2%;background:#67e8f9;transition:width .7s}.meta{display:flex;justify-content:space-between;gap:16px;margin-top:10px;color:#748078;font-size:11px;letter-spacing:.12em;text-transform:uppercase}.note{margin-top:26px;padding-top:18px;border-top:1px solid rgba(0,255,102,.15);color:#87958c;font-size:13px;line-height:1.6}.spin{display:inline-block;width:12px;height:12px;margin-right:8px;border:2px solid rgba(103,232,249,.25);border-top-color:#67e8f9;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><main class="panel"><div class="eyebrow">101st Doom Battalion Systems</div><h1 class="title">Website Updating</h1><p class="message" id="message"><span class="spin"></span>Connecting to update worker...</p><div class="bar"><div class="fill" id="fill"></div></div><div class="meta"><span id="stage">Preparing</span><span id="progress">2%</span></div><p class="note">This page will reconnect and refresh automatically when the updated website is ready. No action is required.</p></main>
<script>
let reloadQueued=false;
async function poll(){try{const response=await fetch('/api/website-update-status',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(!data.job)return;const job=data.job;document.getElementById('message').textContent=job.message;document.getElementById('stage').textContent=job.stage;document.getElementById('progress').textContent=job.progress+'%';document.getElementById('fill').style.width=Math.max(2,Math.min(100,job.progress))+'%';if(job.status==='succeeded'&&!reloadQueued){reloadQueued=true;setTimeout(()=>location.reload(),2500)}if(job.status==='failed'){document.querySelector('.title').textContent='Update Needs Attention';document.getElementById('fill').style.background='#f87171'}}catch{}}
poll();setInterval(poll,2000);
</script></body></html>`;
}

async function startMaintenanceServer() {
  const target = new URL(healthUrl);
  const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
  const host = process.env.WEBSITE_MAINTENANCE_HOST || '::';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.setHeader('Connection', 'close');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.url?.startsWith('/api/website-update-status')) {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(publicStatusPayload()));
        return;
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : maintenanceDocument());
        return;
      }
      response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Website update in progress' }));
    });

    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      maintenanceServer = server;
      append('maintenance', `Maintenance status server listening on ${host}:${port}`);
      return;
    } catch (error) {
      server.close();
      if (error?.code !== 'EADDRINUSE' || attempt === 19) throw error;
      await delay(500);
    }
  }
}

async function stopMaintenanceServer() {
  if (!maintenanceServer) return;
  const server = maintenanceServer;
  maintenanceServer = null;
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

async function startWebsite() {
  await command('restart', 'schtasks.exe', ['/Run', '/TN', websiteTask], { timeout: 30_000 });
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

    for (let remaining = 15; remaining > 0; remaining -= 1) {
      await updateJob(
        'running',
        'countdown',
        `Website update begins in ${remaining} second${remaining === 1 ? '' : 's'}`,
      );
      await delay(1_000);
    }

    await updateJob('running', 'preflight', 'Checking the approved release and deployed working tree');
    const { stdout: status } = await command('preflight', 'git', ['status', '--porcelain', '--untracked-files=no']);
    if (status.trim()) throw new Error('Website Git working tree is not clean');
    const { stdout: current } = await command('preflight', 'git', ['rev-parse', 'HEAD']);
    if (current.trim().toLowerCase() !== job.from_commit) {
      throw new Error('Installed commit changed after the update was approved');
    }
    await updateJob('running', 'fetch', 'Confirming the approved release with the remote repository');
    await command('fetch', 'git', ['-c', 'gc.auto=0', 'fetch', '--prune', 'origin', 'main']);
    const { stdout: target } = await command('fetch', 'git', ['rev-parse', 'origin/main']);
    if (target.trim().toLowerCase() !== job.target_commit) {
      throw new Error('origin/main changed after approval; check again and submit a new update');
    }
    await command('preflight', 'git', ['merge-base', '--is-ancestor', job.from_commit, job.target_commit]);

    const { stdout: dependencyChanges } = await command('preflight', 'git', [
      'diff', '--name-only', job.from_commit, job.target_commit, '--',
      'package.json', 'package-lock.json', 'npm-shrinkwrap.json',
    ]);
    const dependenciesChanged = dependencyChanges.trim().length > 0;

    await updateJob('running', 'backup', 'Creating and verifying the pre-update database backup while the website remains online');
    const backupChildEnv = { ...process.env };
    for (const name of ['DATABASE_URL', 'NATIVE_MIGRATION_DATABASE', 'CUTOVER_CONFIRM_DATABASE']) {
      delete backupChildEnv[name];
    }
    await command('backup', process.execPath, [
      `--env-file=${backupEnv}`,
      path.join(root, 'scripts/postgres/backup-native.mjs'),
    ], {
      env: backupChildEnv,
      progressMessage: 'Creating and verifying the pre-update database backup while the website remains online',
    });

    await updateJob('running', 'stopping', 'Backup verified; stopping the website for installation');
    await command('stop', 'schtasks.exe', ['/End', '/TN', websiteTask], { timeout: 30_000 });
    websiteStopped = true;
    await updateJob('running', 'maintenance', 'Website is offline for installation; live status remains available');
    await startMaintenanceServer();

    await updateJob('running', 'installing', dependenciesChanged
      ? 'Installing the approved source and updated dependencies'
      : 'Installing the approved source; dependencies are unchanged');
    await command('git', 'git', ['merge', '--ff-only', job.target_commit]);
    if (dependenciesChanged) {
      await command('dependencies', process.execPath, [npmCli, 'ci'], {
        timeout: 15 * 60_000,
        progressMessage: 'Installing updated dependencies',
      });
    } else {
      append('dependencies', 'Skipped npm ci because package manifests are unchanged.');
    }

    await updateJob('running', 'migrating', 'Applying checksum-locked database migrations');
    await command('migrations', process.execPath, [
      path.join(root, 'scripts/postgres/apply-native-migrations.mjs'),
      '--cutover',
    ], { progressMessage: 'Applying checksum-locked database migrations' });

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
      progressMessage: 'Creating the production website build',
    });

    await updateJob('running', 'restarting', 'Starting the updated website');
    await stopMaintenanceServer();
    await startWebsite();
    await waitForHealth();
    websiteStopped = false;
    await updateJob('succeeded', 'complete', `Website updated to ${job.target_commit.slice(0, 7)}`, true);
    console.log(`Website update completed: ${job.target_commit.slice(0, 7)}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  append('failure', message);
  await updateJob('failed', 'failed', message.slice(0, 1000), true).catch(() => {});
  if (websiteStopped) {
    await stopMaintenanceServer().catch(() => {});
    await startWebsite()
      .then(() => { websiteStopped = false; })
      .catch((restartError) => append('restart-failure', restartError));
  }
  console.error(`Website update failed: ${message}`);
  process.exitCode = 1;
} finally {
  await stopMaintenanceServer().catch(() => {});
  await client.end();
}
