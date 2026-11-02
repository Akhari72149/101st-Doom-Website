alter table public.mod_pipeline_tasks
  drop constraint if exists mod_pipeline_tasks_type_check;

alter table public.mod_pipeline_tasks
  add constraint mod_pipeline_tasks_type_check
  check (task_type in ('bug','feature','asset','balance','maintenance','documentation','up_for_grabs'));
