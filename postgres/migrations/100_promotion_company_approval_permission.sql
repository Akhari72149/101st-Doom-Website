insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.promotion-readiness-company-approval', '/admin/promotion-readiness/company-approval',
   'Promotion Readiness Company Approval', 'Personnel Admin',
   'Approve and complete promotions into CTS or CXT after all automatic requirements are met.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.promotion-readiness-company-approval', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();
