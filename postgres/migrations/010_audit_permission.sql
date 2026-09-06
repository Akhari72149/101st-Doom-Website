insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('records.audit', '/audit', 'Audit Log', 'Records', 'Review system and personnel audit actions.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

insert into public.user_page_permissions (user_id, permission_key, access_level)
select distinct ur.user_id, 'records.audit', 'full'
from public.user_roles ur
where lower(ur.role) in ('admin', 'nco', 'trainer', 'di')
on conflict (user_id, permission_key) do nothing;

