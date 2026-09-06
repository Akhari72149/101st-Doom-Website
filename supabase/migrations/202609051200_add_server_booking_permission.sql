insert into public.app_page_permissions (
  permission_key,
  page_path,
  label,
  category,
  description
)
values (
  'operations.server-bookings',
  '/servers',
  'Server Booking',
  'Operations',
  'Create and cancel Arma server bookings.'
)
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

insert into public.user_page_permissions (
  user_id,
  permission_key,
  access_level
)
select distinct ur.user_id,
       'operations.server-bookings',
       'full'
from public.user_roles as ur
where lower(ur.role) in ('admin', 'nco', 'trainer', 'akhari')
on conflict (user_id, permission_key) do nothing;
