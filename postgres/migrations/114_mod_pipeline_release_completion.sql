alter table public.mod_pipeline_releases
  add column if not exists release_notes text,
  add column if not exists affected_mods text[] not null default '{}'::text[],
  add column if not exists task_snapshot jsonb not null default '[]'::jsonb;

alter table public.mod_pipeline_releases
  drop constraint if exists mod_pipeline_releases_affected_mods_check;

alter table public.mod_pipeline_releases
  add constraint mod_pipeline_releases_affected_mods_check
  check (
    affected_mods <@ array[
      'dba_core',
      'dba_republic',
      'dba_cis',
      'dba_imperial',
      'dba_independant',
      '101st_aux',
      'musical_archives'
    ]::text[]
  );

alter table public.mod_pipeline_releases
  drop constraint if exists mod_pipeline_releases_task_snapshot_check;

alter table public.mod_pipeline_releases
  add constraint mod_pipeline_releases_task_snapshot_check
  check (jsonb_typeof(task_snapshot) = 'array');
