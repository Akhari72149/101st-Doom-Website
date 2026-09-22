insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.discipline-approval', '/admin/discipline/approval', 'DA Approval', 'Records',
   'Read opens the approval queue; Edit or Full can approve or reject submitted disciplinary actions.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

update public.app_page_permissions
set description = 'Issue and review warnings, disciplinary actions, and appeals.',
    updated_at = now()
where permission_key = 'admin.discipline';

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.discipline-approval', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();
