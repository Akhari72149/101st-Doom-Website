create table if not exists public.account_role_tags (
  user_id uuid not null references public.app_auth_users(id) on delete cascade,
  tag text not null check (tag in (
    'trainer',
    'nco',
    'recruiter',
    'drill-instructor',
    'server-maintenance'
  )),
  assigned_by uuid references public.app_auth_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create index if not exists account_role_tags_tag_idx
  on public.account_role_tags(tag);

alter table public.account_role_tags enable row level security;
revoke all on public.account_role_tags from public;
grant select, insert, delete on public.account_role_tags to roster_app_runtime;

drop policy if exists "native runtime account role tag reads" on public.account_role_tags;
create policy "native runtime account role tag reads"
  on public.account_role_tags for select to roster_app_runtime using (true);

drop policy if exists "native runtime account role tag inserts" on public.account_role_tags;
create policy "native runtime account role tag inserts"
  on public.account_role_tags for insert to roster_app_runtime with check (true);

drop policy if exists "native runtime account role tag deletes" on public.account_role_tags;
create policy "native runtime account role tag deletes"
  on public.account_role_tags for delete to roster_app_runtime using (true);
