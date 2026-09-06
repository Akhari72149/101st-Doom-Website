insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.updater', '/admin/updater', 'Updater', 'Systems',
   'Review releases and install approved website updates.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

create table if not exists public.website_update_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  requested_by_name text not null,
  from_commit text not null check (from_commit ~ '^[0-9a-f]{40}$'),
  target_commit text not null check (target_commit ~ '^[0-9a-f]{40}$'),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  stage text not null default 'queued',
  message text,
  output text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists website_update_jobs_one_active_idx
  on public.website_update_jobs ((true))
  where status in ('pending', 'running');
create index if not exists website_update_jobs_recent_idx
  on public.website_update_jobs (requested_at desc);

alter table public.website_update_jobs enable row level security;
revoke all on public.website_update_jobs from public;
grant select, insert on public.website_update_jobs to roster_app_runtime;
grant select on public.website_update_jobs to roster_app_backup;

drop policy if exists "native runtime website update reads" on public.website_update_jobs;
create policy "native runtime website update reads"
  on public.website_update_jobs for select to roster_app_runtime using (true);
drop policy if exists "native runtime website update requests" on public.website_update_jobs;
create policy "native runtime website update requests"
  on public.website_update_jobs for insert to roster_app_runtime with check (
    status = 'pending' and stage = 'queued'
  );
