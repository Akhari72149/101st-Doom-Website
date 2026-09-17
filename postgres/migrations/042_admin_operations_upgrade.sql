alter table public.personnel
  add column if not exists rank_effective_at timestamptz;

update public.personnel personnel
set rank_effective_at = coalesce(
  (
    select history.changed_at
    from public.rank_history history
    where history.personnel_id = personnel.id
      and history.new_rank_id is not distinct from personnel.rank_id
    order by history.changed_at desc nulls last
    limit 1
  ),
  personnel.created_at at time zone 'UTC'
)
where personnel.rank_effective_at is null;

create or replace function public.set_personnel_rank_effective_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.rank_effective_at is null then
    new.rank_effective_at := coalesce(new.created_at at time zone 'UTC', now());
  elsif tg_op = 'UPDATE' and new.rank_id is distinct from old.rank_id
    and new.rank_effective_at is not distinct from old.rank_effective_at then
    new.rank_effective_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_personnel_rank_effective_at on public.personnel;
create trigger set_personnel_rank_effective_at
before insert or update of rank_id, rank_effective_at on public.personnel
for each row execute function public.set_personnel_rank_effective_at();

alter table public.ranks
  add column if not exists is_active boolean not null default true;

create table if not exists public.system_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('succeeded', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  rows_returned integer,
  error_message text
);

create index if not exists system_job_runs_job_completed_idx
  on public.system_job_runs (job_name, completed_at desc);

create table if not exists public.personnel_xp_adjustments (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  xp_delta integer not null check (xp_delta between -100000 and 100000 and xp_delta <> 0),
  previous_total integer not null,
  new_total integer not null,
  reason text not null check (length(reason) between 3 and 500),
  adjusted_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists personnel_xp_adjustments_personnel_idx
  on public.personnel_xp_adjustments (personnel_id, created_at desc);

insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values
  ('admin.ranks', '/admin/ranks', 'Rank Management', 'Personnel Admin', 'Create, edit, and retire rank definitions.'),
  ('admin.system-health', '/admin/system-health', 'System Health', 'Systems', 'Review database, scheduler, Discord, updater, and XP health.'),
  ('admin.xp', '/admin/xp', 'XP Management', 'Systems', 'Review and correct personnel XP with a permanent audit trail.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, permissions.permission_key, 'full', users.id, now()
from public.app_auth_users users
join public.app_page_permissions permissions
  on permissions.permission_key in ('admin.ranks', 'admin.system-health', 'admin.xp')
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();

grant select on public.ranks, public.system_job_runs, public.personnel_xp_adjustments to roster_app_runtime;
grant insert, update on public.ranks to roster_app_runtime;
grant insert, select on public.personnel_xp_adjustments to roster_app_runtime;
grant insert, update on public.personnel_xp_profiles, public.personnel_xp_weekly_stats to roster_app_runtime;
grant insert on public.system_job_runs to roster_app_scheduler;
