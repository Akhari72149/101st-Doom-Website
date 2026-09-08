-- Page permissions are authoritative. Keep the protected superuser able to
-- administer every current and future permission without relying on legacy roles.
insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, permissions.permission_key, 'full', users.id, now()
from public.app_auth_users users
cross join public.app_page_permissions permissions
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full',
    granted_by = excluded.granted_by,
    updated_at = now();
