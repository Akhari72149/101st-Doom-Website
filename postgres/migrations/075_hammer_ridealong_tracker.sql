create table if not exists public.hammer_ridealong_trainees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  started_course date,
  ground_school text not null default '',
  flight_school text not null default '',
  sere text not null default '',
  cxc_test text not null default '',
  flight text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_auth_users(id) on delete set null
);

create unique index if not exists hammer_ridealong_trainees_name_idx
  on public.hammer_ridealong_trainees (lower(btrim(name)));
create index if not exists hammer_ridealong_trainees_order_idx
  on public.hammer_ridealong_trainees (active desc, sort_order, lower(name));

create table if not exists public.hammer_ridealong_reports (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.hammer_ridealong_trainees(id) on delete cascade,
  phase smallint not null check (phase in (1, 2)),
  operation_type text not null check (operation_type in ('mainop', 'funop', 'training')),
  zeus text not null check (char_length(btrim(zeus)) between 1 and 120),
  pilot_supervisor text not null check (char_length(btrim(pilot_supervisor)) between 1 and 120),
  activity text not null check (activity in ('ball-gunning', 'flying')),
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists hammer_ridealong_reports_trainee_idx
  on public.hammer_ridealong_reports (trainee_id, phase, occurred_on, created_at);

alter table public.hammer_ridealong_trainees enable row level security;
alter table public.hammer_ridealong_reports enable row level security;
revoke all on public.hammer_ridealong_trainees from public;
revoke all on public.hammer_ridealong_reports from public;
grant select, insert, update, delete on public.hammer_ridealong_trainees to roster_app_runtime;
grant select, insert, update, delete on public.hammer_ridealong_reports to roster_app_runtime;

drop policy if exists "native runtime hammer trainees" on public.hammer_ridealong_trainees;
create policy "native runtime hammer trainees" on public.hammer_ridealong_trainees
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime hammer reports" on public.hammer_ridealong_reports;
create policy "native runtime hammer reports" on public.hammer_ridealong_reports
  for all to roster_app_runtime using (true) with check (true);

insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.hammer-ridealongs', '/hammer-ridealongs', 'Hammer Ridealong Tracker', 'Operations',
        'Maintain Hammer trainee profiles, progression milestones, and ridealong records.')
on conflict (permission_key) do update
set page_path=excluded.page_path, label=excluded.label, category=excluded.category,
    description=excluded.description, updated_at=now();

insert into public.user_page_permissions (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.hammer-ridealongs', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();
