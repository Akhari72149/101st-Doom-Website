insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values
  ('admin.mod-taskboard', '/admin/Mod-Taskboard', 'Mod Taskboard', 'Systems', 'Create and manage mod development pipeline items.'),
  ('operations.randomiser', '/Randomiser', 'Side Operation Randomiser', 'Operations', 'Manage side-operation signups, weighted selection, and operation settings.')
on conflict (permission_key) do update
set page_path = excluded.page_path, label = excluded.label, category = excluded.category,
    description = excluded.description, updated_at = now();

insert into public.user_page_permissions (user_id, permission_key, access_level)
select distinct ur.user_id, 'admin.mod-taskboard', 'full'
from public.user_roles ur where lower(ur.role) = 'akhari'
on conflict (user_id, permission_key) do nothing;

insert into public.user_page_permissions (user_id, permission_key, access_level)
select distinct ur.user_id, 'operations.randomiser', 'full'
from public.user_roles ur where lower(ur.role) in ('admin', 'logistics')
on conflict (user_id, permission_key) do nothing;

grant select, insert, update, delete on
  public.mod_pipeline_assignees,
  public.mod_pipeline_tasks,
  public.mod_pipeline_comments,
  public.side_operations,
  public.side_operation_signups,
  public.side_operation_levels
to roster_app_runtime;

drop policy if exists "native runtime mod pipeline assignees" on public.mod_pipeline_assignees;
create policy "native runtime mod pipeline assignees" on public.mod_pipeline_assignees
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime mod pipeline tasks" on public.mod_pipeline_tasks;
create policy "native runtime mod pipeline tasks" on public.mod_pipeline_tasks
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime mod pipeline comments" on public.mod_pipeline_comments;
create policy "native runtime mod pipeline comments" on public.mod_pipeline_comments
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime side operations" on public.side_operations;
create policy "native runtime side operations" on public.side_operations
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime side operation signups" on public.side_operation_signups;
create policy "native runtime side operation signups" on public.side_operation_signups
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime side operation levels" on public.side_operation_levels;
create policy "native runtime side operation levels" on public.side_operation_levels
  for all to roster_app_runtime using (true) with check (true);

create unique index if not exists side_operation_signups_operation_name_ci_key
  on public.side_operation_signups (operation_id, lower(btrim(name)));
