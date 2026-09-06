insert into public.app_page_permissions
  (permission_key, page_path, label, category, description, updated_at)
values
  (
    'admin.account-management',
    '/admin/permissions/accounts',
    'Account Management',
    'Systems',
    'Create, disable, enable, and delete website login accounts.',
    now()
  ),
  (
    'admin.account-password-reset',
    '/admin/permissions/password-reset',
    'Password Reset',
    'Systems',
    'Issue a temporary password and require a password change at next login.',
    now()
  )
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

alter table public.user_page_permissions
  drop constraint if exists user_page_permissions_user_id_fkey;

alter table public.user_page_permissions
  add constraint user_page_permissions_user_id_fkey
  foreign key (user_id) references public.app_auth_users(id) on delete cascade
  not valid;

alter table public.user_page_permissions
  drop constraint if exists user_page_permissions_granted_by_fkey;

alter table public.user_page_permissions
  add constraint user_page_permissions_granted_by_fkey
  foreign key (granted_by) references public.app_auth_users(id) on delete set null
  not valid;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, permissions.permission_key, 'full', users.id, now()
from public.app_auth_users users
cross join (
  values
    ('admin.permissions'),
    ('admin.account-management'),
    ('admin.account-password-reset')
) as permissions(permission_key)
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full',
    granted_by = excluded.granted_by,
    updated_at = now();
