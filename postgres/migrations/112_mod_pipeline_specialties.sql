alter table public.mod_pipeline_assignees
  add column if not exists specialties text[] not null default '{}'::text[];

alter table public.mod_pipeline_assignees
  drop constraint if exists mod_pipeline_assignees_specialties_check;

alter table public.mod_pipeline_assignees
  add constraint mod_pipeline_assignees_specialties_check
  check (
    specialties <@ array[
      'armour_artist','texture_artist','model_artist','script_artist','testing_team','animation_artist'
    ]::text[]
    and cardinality(specialties) <= 6
  );

create index if not exists mod_pipeline_assignees_specialties_idx
  on public.mod_pipeline_assignees using gin(specialties);
