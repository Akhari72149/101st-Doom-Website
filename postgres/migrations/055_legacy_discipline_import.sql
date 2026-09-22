alter table public.disciplinary_cases
  add column if not exists source_system text,
  add column if not exists source_key text,
  add column if not exists legacy_issuer_name text;

create unique index if not exists disciplinary_cases_source_key_idx
  on public.disciplinary_cases (source_system, source_key)
  where source_system is not null and source_key is not null;

alter table public.disciplinary_bans
  add column if not exists source_system text,
  add column if not exists source_key text;

create unique index if not exists disciplinary_bans_source_key_idx
  on public.disciplinary_bans (source_system, source_key)
  where source_system is not null and source_key is not null;
