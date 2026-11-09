alter table public.mod_pipeline_tasks
  add column if not exists parent_task_id uuid references public.mod_pipeline_tasks(id) on delete set null;

alter table public.mod_pipeline_tasks
  drop constraint if exists mod_pipeline_tasks_parent_not_self_check;

alter table public.mod_pipeline_tasks
  add constraint mod_pipeline_tasks_parent_not_self_check
  check (parent_task_id is null or parent_task_id <> id);

create index if not exists mod_pipeline_tasks_parent_idx
  on public.mod_pipeline_tasks(parent_task_id)
  where parent_task_id is not null;

create table if not exists public.mod_pipeline_watchers (
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  user_id uuid not null references public.app_auth_users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.mod_pipeline_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.app_auth_users(id) on delete cascade,
  task_id uuid references public.mod_pipeline_tasks(id) on delete cascade,
  actor_id uuid references public.app_auth_users(id) on delete set null,
  event_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mod_pipeline_notifications_recipient_idx
  on public.mod_pipeline_notifications(recipient_id, read_at, created_at desc);

create index if not exists mod_pipeline_notifications_task_idx
  on public.mod_pipeline_notifications(task_id, created_at desc);

grant select, insert, delete on public.mod_pipeline_watchers to roster_app_runtime;
grant select, insert, update, delete on public.mod_pipeline_notifications to roster_app_runtime;

alter table public.mod_pipeline_watchers enable row level security;
alter table public.mod_pipeline_notifications enable row level security;

drop policy if exists "native runtime mod pipeline watchers" on public.mod_pipeline_watchers;
create policy "native runtime mod pipeline watchers"
  on public.mod_pipeline_watchers for all to roster_app_runtime
  using (true) with check (true);

drop policy if exists "native runtime mod pipeline notifications" on public.mod_pipeline_notifications;
create policy "native runtime mod pipeline notifications"
  on public.mod_pipeline_notifications for all to roster_app_runtime
  using (true) with check (true);
