create table if not exists public.personnel_loa_periods (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  discord_id text not null,
  loa_type text not null default 'LOA' check (char_length(loa_type) between 1 and 50),
  expected_end_text text check (expected_end_text is null or char_length(expected_end_text) <= 100),
  reason text check (reason is null or char_length(reason) <= 1000),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'discord-bot' check (char_length(source) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists personnel_loa_one_active_idx
  on public.personnel_loa_periods (personnel_id)
  where ended_at is null;

create index if not exists personnel_loa_history_idx
  on public.personnel_loa_periods (personnel_id, started_at desc);

alter table public.personnel_loa_periods enable row level security;
revoke all on public.personnel_loa_periods from public;
grant select, insert, update on public.personnel_loa_periods to roster_app_runtime;
grant select on public.personnel_loa_periods to roster_app_backup;

drop policy if exists "runtime personnel loa periods" on public.personnel_loa_periods;
create policy "runtime personnel loa periods" on public.personnel_loa_periods
  for all to roster_app_runtime using (true) with check (true);

create or replace function public.personnel_tig_days(
  target_personnel_id uuid,
  as_of timestamptz default now()
)
returns integer
language sql
stable
set search_path = public
as $$
  with person as (
    select coalesce(rank_effective_at, created_at at time zone 'UTC') as effective_at
      from public.personnel
     where id = target_personnel_id
  ), paused as (
    select coalesce(sum(
      extract(epoch from (
        least(coalesce(periods.ended_at, as_of), as_of)
        - greatest(periods.started_at, person.effective_at)
      ))
    ), 0) as paused_seconds
      from person
      join public.personnel_loa_periods periods
        on periods.personnel_id = target_personnel_id
       and periods.started_at < as_of
       and coalesce(periods.ended_at, as_of) > person.effective_at
  )
  select coalesce(
    greatest(0, floor((extract(epoch from (as_of - person.effective_at)) - paused.paused_seconds) / 86400))::integer,
    0
  )
    from person cross join paused;
$$;

revoke all on function public.personnel_tig_days(uuid, timestamptz) from public;
grant execute on function public.personnel_tig_days(uuid, timestamptz) to roster_app_runtime;

