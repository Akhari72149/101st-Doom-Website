alter table public.disciplinary_cases
  add column if not exists witnesses text not null default '',
  add column if not exists appeal_wait_days integer not null default 0
    check (appeal_wait_days between 0 and 3650),
  add column if not exists appeal_eligible_at timestamptz;

update public.disciplinary_cases
set appeal_eligible_at = coalesce(appeal_eligible_at, created_at)
where appeal_eligible_at is null;

alter table public.disciplinary_cases
  alter column appeal_eligible_at set not null;

alter table public.disciplinary_appeals
  add column if not exists eligibility_bypassed boolean not null default false,
  add column if not exists bypass_reason text;

create table if not exists public.disciplinary_bans (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references public.personnel(id) on delete set null,
  display_name text not null check (length(display_name) between 1 and 180),
  birth_number text,
  banned_on date not null,
  reason text not null check (length(reason) between 3 and 5000),
  evidence_url text,
  notes text,
  status text not null default 'active' check (status in ('active', 'lifted')),
  created_by uuid not null references public.app_auth_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  lifted_by uuid references public.app_auth_users(id) on delete set null,
  lifted_at timestamptz,
  lift_reason text,
  check ((status = 'active' and lifted_at is null) or
    (status = 'lifted' and lifted_at is not null and lift_reason is not null))
);

create unique index if not exists disciplinary_bans_active_personnel_idx
  on public.disciplinary_bans (personnel_id)
  where status = 'active' and personnel_id is not null;

create index if not exists disciplinary_bans_status_idx
  on public.disciplinary_bans (status, banned_on desc);

alter table public.disciplinary_bans enable row level security;
revoke all on public.disciplinary_bans from public;
grant select, insert, update on public.disciplinary_bans to roster_app_runtime;

create policy "native runtime discipline bans"
  on public.disciplinary_bans for all to roster_app_runtime
  using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'roster_app_backup') then
    grant select on public.disciplinary_bans to roster_app_backup;
  end if;
end
$$;
