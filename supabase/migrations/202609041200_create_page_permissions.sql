create table if not exists public.app_page_permissions (
  permission_key text primary key,
  page_path text not null unique,
  label text not null,
  category text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_page_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.app_page_permissions(permission_key) on delete cascade,
  access_level text not null check (access_level in ('read', 'edit', 'full')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index if not exists user_page_permissions_user_idx
  on public.user_page_permissions (user_id);

create index if not exists user_page_permissions_permission_idx
  on public.user_page_permissions (permission_key);

alter table public.app_page_permissions enable row level security;
alter table public.user_page_permissions enable row level security;

revoke all on public.app_page_permissions from anon;
revoke all on public.user_page_permissions from anon;

grant select on public.app_page_permissions to authenticated;
grant select on public.user_page_permissions to authenticated;
grant all on public.app_page_permissions to service_role;
grant all on public.user_page_permissions to service_role;

drop policy if exists "authenticated can read page permission definitions" on public.app_page_permissions;
create policy "authenticated can read page permission definitions"
  on public.app_page_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "users can read their page permissions" on public.user_page_permissions;
create policy "users can read their page permissions"
  on public.user_page_permissions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.app_page_permissions (
  permission_key,
  page_path,
  label,
  category,
  description
)
values
  ('admin.create', '/admin/create', 'Create Accounts', 'Personnel Admin', 'Create new website and personnel records.'),
  ('admin.positions', '/admin/positions', 'Ranks & Slots', 'Personnel Admin', 'Manage ranks, MOS, slots, and billet assignments.'),
  ('admin.certifications', '/admin/certifications', 'Certifications', 'Personnel Admin', 'Award and remove personnel certifications.'),
  ('admin.medals', '/admin/medals', 'Medals', 'Personnel Admin', 'Award and remove medals on personnel dossiers.'),
  ('admin.weekly-attendance', '/admin/weekly-attendance', 'Weekly Attendance Admin', 'Records', 'Update weekly attendance records.'),
  ('admin.discord-attendance', '/admin/discord-attendance', 'Discord Attendance', 'Records', 'Create and manage Discord attendance embeds.'),
  ('admin.removal', '/admin/removal', 'Remove / Retire', 'Records', 'Remove, retire, or archive personnel records.'),
  ('admin.removal-log', '/admin/removal-log', 'Removal Log', 'Records', 'Review removal and retirement history.'),
  ('admin.discord-announcements', '/admin/discord-announcemets', 'Discord Pings', 'Systems', 'Create scheduled Discord announcements and pings.'),
  ('admin.server-control', '/admin/server-control', 'Server Control', 'Systems', 'Start, stop, and monitor Arma servers.'),
  ('admin.permissions', '/admin/permissions', 'Permissions', 'Systems', 'Manage login accounts and page permissions.'),
  ('gc.asset-log', '/GC-Asset-Log', 'GC Asset Log', 'Logistics', 'Review campaign asset transaction history.'),
  ('gc.logistics', '/GC-Logi', 'GC Logistics', 'Logistics', 'Manage campaign logistics and distribution.'),
  ('cis.logistics', '/CIS-Logi', 'CIS Logistics', 'Logistics', 'Manage CIS commander assets and logistics actions.'),
  ('personnel.command-dashboard', '/pcs', 'Personnel Command Dashboard', 'Personnel', 'Command overview and restricted personnel tools.'),
  ('operations.planops', '/planops', 'Plan Ops', 'Operations', 'Create and edit operational planning boards.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

with legacy_role_permissions(role_name, permission_key) as (
  values
    ('admin', 'admin.create'),
    ('recruiter', 'admin.create'),
    ('admin', 'admin.positions'),
    ('nco', 'admin.positions'),
    ('di', 'admin.positions'),
    ('admin', 'admin.certifications'),
    ('nco', 'admin.certifications'),
    ('trainer', 'admin.certifications'),
    ('admin', 'admin.medals'),
    ('nco', 'admin.medals'),
    ('di', 'admin.medals'),
    ('recruiter', 'admin.medals'),
    ('akhari', 'admin.medals'),
    ('admin', 'admin.weekly-attendance'),
    ('nco', 'admin.weekly-attendance'),
    ('admin', 'admin.discord-attendance'),
    ('nco', 'admin.discord-attendance'),
    ('akhari', 'admin.discord-attendance'),
    ('admin', 'admin.removal'),
    ('nco', 'admin.removal'),
    ('admin', 'admin.removal-log'),
    ('nco', 'admin.removal-log'),
    ('recruiter', 'admin.removal-log'),
    ('admin', 'admin.discord-announcements'),
    ('akhari', 'admin.discord-announcements'),
    ('servermaintenance', 'admin.server-control'),
    ('akhari', 'admin.server-control'),
    ('admin', 'admin.permissions'),
    ('akhari', 'admin.permissions'),
    ('akhari', 'gc.asset-log'),
    ('logistics', 'gc.asset-log'),
    ('akhari', 'gc.logistics'),
    ('logistics', 'gc.logistics'),
    ('admin', 'gc.logistics'),
    ('akhari', 'cis.logistics'),
    ('logistics', 'cis.logistics'),
    ('admin', 'personnel.command-dashboard'),
    ('nco', 'personnel.command-dashboard'),
    ('di', 'personnel.command-dashboard'),
    ('trainer', 'personnel.command-dashboard'),
    ('recruiter', 'personnel.command-dashboard'),
    ('akhari', 'personnel.command-dashboard'),
    ('admin', 'operations.planops'),
    ('logistics', 'operations.planops'),
    ('nco', 'operations.planops'),
    ('trainer', 'operations.planops')
)
insert into public.user_page_permissions (
  user_id,
  permission_key,
  access_level
)
select distinct ur.user_id,
       legacy.permission_key,
       'full'
from public.user_roles as ur
join legacy_role_permissions as legacy
  on lower(ur.role) = legacy.role_name
on conflict (user_id, permission_key) do nothing;
