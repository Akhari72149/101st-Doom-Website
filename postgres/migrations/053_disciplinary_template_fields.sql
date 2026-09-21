alter table public.disciplinary_case_templates
  add column if not exists witnesses text not null default '',
  add column if not exists appeal_wait_days integer not null default 0
    check (appeal_wait_days between 0 and 3650);
