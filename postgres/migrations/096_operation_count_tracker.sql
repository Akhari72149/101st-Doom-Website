create table if not exists public.operation_count_submissions (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  rank_id uuid references public.ranks(id) on delete set null,
  rank_stage text not null check (rank_stage in ('CR', 'CR-C')),
  attendance_type text not null check (attendance_type in ('mainop', 'funop', 'rto-course', 'cls-course')),
  host_name text not null check (char_length(btrim(host_name)) between 1 and 120),
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists operation_count_submissions_personnel_idx
  on public.operation_count_submissions (personnel_id, rank_stage, occurred_on, created_at);

create unique index if not exists operation_count_submissions_duplicate_idx
  on public.operation_count_submissions
  (personnel_id, rank_stage, attendance_type, occurred_on, lower(btrim(host_name)));

alter table public.operation_count_submissions enable row level security;
revoke all on public.operation_count_submissions from public;
grant select, insert on public.operation_count_submissions to roster_app_runtime;

drop policy if exists "native runtime operation count submissions" on public.operation_count_submissions;
create policy "native runtime operation count submissions"
  on public.operation_count_submissions for all to roster_app_runtime
  using (true) with check (true);

insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.operation-counts', '/operation-counts/responses', 'Operation Count Responses', 'Operations',
   'Review and record CR and CR-C operation counts and credited progression records.')
on conflict (permission_key) do update
set page_path=excluded.page_path,
    label=excluded.label,
    category=excluded.category,
    description=excluded.description,
    updated_at=now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.operation-counts', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();
