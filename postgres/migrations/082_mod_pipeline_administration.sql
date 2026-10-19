insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values (
  'admin.mod-taskboard-admin',
  '/admin/Mod-Taskboard/administration',
  'Mod Pipeline Administration',
  'Systems',
  'Manage task owners, contributors, dependencies, releases, approvals, and archived pipeline records.'
)
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

update public.app_page_permissions
set label = 'Mod Pipeline',
    description = 'Access the Mod Pipeline and create, edit, move, comment on, and complete task work.',
    updated_at = now()
where permission_key = 'admin.mod-taskboard';

insert into public.user_page_permissions (user_id, permission_key, access_level, granted_by, updated_at)
select user_id, 'admin.mod-taskboard-admin', 'full', granted_by, now()
from public.user_page_permissions
where permission_key = 'admin.mod-taskboard'
  and access_level = 'full'
on conflict (user_id, permission_key) do nothing;

insert into public.mod_pipeline_assignees (id, name)
select profiles.id, profiles.display_name
from public.profiles profiles
join public.app_auth_users users on users.id = profiles.id
where users.disabled = false
on conflict (id) do update set name = excluded.name;
