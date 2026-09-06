insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.taskboard', '/admin/Taskboard', 'Taskboard', 'Systems', 'Create and manage website taskboard items.')
on conflict (permission_key) do update
set page_path = excluded.page_path, label = excluded.label, category = excluded.category,
    description = excluded.description, updated_at = now();

insert into public.user_page_permissions (user_id, permission_key, access_level)
select distinct ur.user_id, 'admin.taskboard', 'full'
from public.user_roles ur where lower(ur.role) in ('admin', 'akhari')
on conflict (user_id, permission_key) do nothing;

grant select, insert, update, delete on public.taskboard_tasks, public.taskboard_comments to roster_app_runtime;

drop policy if exists "native runtime taskboard tasks" on public.taskboard_tasks;
create policy "native runtime taskboard tasks" on public.taskboard_tasks
  for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime taskboard comments" on public.taskboard_comments;
create policy "native runtime taskboard comments" on public.taskboard_comments
  for all to roster_app_runtime using (true) with check (true);

