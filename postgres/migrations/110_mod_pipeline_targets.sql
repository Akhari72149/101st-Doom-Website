alter table public.mod_pipeline_tasks
  add column if not exists mod_targets text[] not null default '{}'::text[];

alter table public.mod_pipeline_tasks
  drop constraint if exists mod_pipeline_tasks_mod_targets_check;

alter table public.mod_pipeline_tasks
  add constraint mod_pipeline_tasks_mod_targets_check
  check (
    mod_targets <@ array[
      'dba_core','dba_republic','dba_cis','dba_imperial','dba_independant','101st_aux'
    ]::text[]
    and cardinality(mod_targets) <= 6
  );

create index if not exists mod_pipeline_tasks_mod_targets_idx
  on public.mod_pipeline_tasks using gin(mod_targets);
