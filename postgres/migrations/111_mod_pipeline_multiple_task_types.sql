alter table public.mod_pipeline_tasks
  add column if not exists task_types text[] not null default '{}'::text[];

update public.mod_pipeline_tasks
set task_types=array[task_type]
where cardinality(task_types)=0;

alter table public.mod_pipeline_tasks
  drop constraint if exists mod_pipeline_tasks_task_types_check;

alter table public.mod_pipeline_tasks
  add constraint mod_pipeline_tasks_task_types_check
  check (
    task_types <@ array[
      'bug','feature','asset','balance','maintenance','documentation','up_for_grabs'
    ]::text[]
    and cardinality(task_types) between 1 and 7
  );

create index if not exists mod_pipeline_tasks_task_types_idx
  on public.mod_pipeline_tasks using gin(task_types);
