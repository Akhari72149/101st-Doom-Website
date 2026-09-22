create table if not exists public.disciplinary_legacy_subjects (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  subject_key text not null,
  display_name text not null check (length(display_name) between 1 and 180),
  birth_number text,
  created_at timestamptz not null default now(),
  unique (source_system, subject_key)
);

alter table public.disciplinary_cases
  alter column personnel_id drop not null,
  add column if not exists legacy_subject_id uuid
    references public.disciplinary_legacy_subjects(id) on delete restrict;

alter table public.disciplinary_cases
  drop constraint if exists disciplinary_cases_subject_check;
alter table public.disciplinary_cases
  add constraint disciplinary_cases_subject_check
  check ((personnel_id is not null) <> (legacy_subject_id is not null));

create index if not exists disciplinary_cases_legacy_subject_idx
  on public.disciplinary_cases (legacy_subject_id, created_at desc)
  where legacy_subject_id is not null;

alter table public.disciplinary_bans
  add column if not exists legacy_subject_id uuid
    references public.disciplinary_legacy_subjects(id) on delete set null;

alter table public.disciplinary_legacy_subjects enable row level security;
revoke all on public.disciplinary_legacy_subjects from public;
grant select, insert, update on public.disciplinary_legacy_subjects to roster_app_runtime;

create policy "native runtime discipline legacy subjects"
  on public.disciplinary_legacy_subjects for all to roster_app_runtime
  using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'roster_app_backup') then
    grant select on public.disciplinary_legacy_subjects to roster_app_backup;
  end if;
end
$$;
