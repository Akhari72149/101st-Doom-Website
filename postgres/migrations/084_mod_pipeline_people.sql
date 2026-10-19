alter table public.mod_pipeline_assignees
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists mod_pipeline_assignees_active_name_idx
  on public.mod_pipeline_assignees(active,name);
