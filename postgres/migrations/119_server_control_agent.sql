create table if not exists public.server_control_agents (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  display_name text not null,
  version text,
  status text not null default 'offline' check (status in ('online', 'busy', 'offline', 'error')),
  details jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.server_control_jobs (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.server_control_agents(id) on delete restrict,
  server_id smallint check (server_id between 1 and 3),
  action text not null check (action in (
    'server.start', 'server.stop', 'server.restart',
    'steamcmd.server.update', 'steamcmd.mods.update'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  requested_by uuid references public.app_auth_users(id) on delete set null,
  requested_by_name text not null,
  claimed_by text,
  claim_token uuid,
  attempts integer not null default 0 check (attempts >= 0),
  result jsonb,
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.server_control_job_logs (
  id bigserial primary key,
  job_id uuid not null references public.server_control_jobs(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists server_control_jobs_recent_idx
  on public.server_control_jobs (requested_at desc);
create index if not exists server_control_jobs_claim_idx
  on public.server_control_jobs (agent_id, status, requested_at);
create index if not exists server_control_job_logs_job_idx
  on public.server_control_job_logs (job_id, id);
create unique index if not exists server_control_one_active_server_action_idx
  on public.server_control_jobs (agent_id, server_id)
  where status in ('pending', 'processing') and server_id is not null;

alter table public.server_control_agents enable row level security;
alter table public.server_control_jobs enable row level security;
alter table public.server_control_job_logs enable row level security;

revoke all on public.server_control_agents from public;
revoke all on public.server_control_jobs from public;
revoke all on public.server_control_job_logs from public;
grant select, insert, update on public.server_control_agents to roster_app_runtime;
grant select, insert, update on public.server_control_jobs to roster_app_runtime;
grant select, insert on public.server_control_job_logs to roster_app_runtime;
grant usage, select on sequence public.server_control_job_logs_id_seq to roster_app_runtime;
grant select on public.server_control_agents, public.server_control_jobs, public.server_control_job_logs to roster_app_backup;

drop policy if exists "runtime server agents" on public.server_control_agents;
create policy "runtime server agents" on public.server_control_agents
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "runtime server jobs" on public.server_control_jobs;
create policy "runtime server jobs" on public.server_control_jobs
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "runtime server job logs" on public.server_control_job_logs;
create policy "runtime server job logs" on public.server_control_job_logs
  for all to roster_app_runtime using (true) with check (true);

