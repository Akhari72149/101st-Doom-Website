insert into public.user_page_permissions (user_id, permission_key, access_level)
select distinct ur.user_id, 'admin.create', 'full'
from public.user_roles ur where lower(ur.role) in ('di', 'nco')
on conflict (user_id, permission_key) do nothing;
