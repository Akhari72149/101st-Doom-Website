create table if not exists public.map_requests (
  id uuid primary key default gen_random_uuid(),
  unit_name text not null check (char_length(btrim(unit_name)) between 1 and 120),
  map_url text not null,
  workshop_id text not null unique check (workshop_id ~ '^[0-9]{1,20}$'),
  acknowledgement_accepted boolean not null default true check (acknowledgement_accepted),
  added_to_server boolean not null default false,
  added_at timestamptz,
  added_by uuid references public.app_auth_users(id) on delete set null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_requests_status_requested_idx
  on public.map_requests (added_to_server, requested_at desc);

alter table public.map_requests enable row level security;
revoke all on public.map_requests from public;
grant select, insert, update on public.map_requests to roster_app_runtime;

drop policy if exists "native runtime map requests" on public.map_requests;
create policy "native runtime map requests"
  on public.map_requests for all to roster_app_runtime
  using (true) with check (true);

insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.map-requests', '/map-requests', 'Map Request Management', 'Operations',
   'Review public Workshop map requests and record whether each map has been added to the server.')
on conflict (permission_key) do update
set page_path=excluded.page_path,
    label=excluded.label,
    category=excluded.category,
    description=excluded.description,
    updated_at=now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.map-requests', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();
