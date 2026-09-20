insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.promotion-readiness', '/admin/promotion-readiness', 'Promotion Readiness', 'Personnel Admin', 'Review calculated promotion progress and outstanding requirements.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.promotion-readiness', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();

grant select on public.personnel, public.ranks, public.rank_history, public.attendance_records
  to roster_app_runtime;
