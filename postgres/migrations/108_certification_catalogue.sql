alter table public.certifications
  add column if not exists is_active boolean not null default true;

update public.certifications set is_active=true where is_active is null;

create index if not exists certifications_active_name_idx
  on public.certifications (is_active, lower(name));

grant insert on public.certifications to roster_app_runtime;
grant update (name, cert_id, is_active) on public.certifications to roster_app_runtime;

drop policy if exists "native runtime certification catalogue inserts" on public.certifications;
create policy "native runtime certification catalogue inserts"
  on public.certifications for insert to roster_app_runtime
  with check (true);

drop policy if exists "native runtime certification catalogue updates" on public.certifications;
create policy "native runtime certification catalogue updates"
  on public.certifications for update to roster_app_runtime
  using (true)
  with check (true);

insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.certification-catalogue', '/admin/certification-catalogue', 'Certification Catalogue', 'Personnel Admin',
   'Create, edit, activate, and retire certification definitions and their Discord roles.')
on conflict (permission_key) do update
set page_path=excluded.page_path,
    label=excluded.label,
    category=excluded.category,
    description=excluded.description,
    updated_at=now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.certification-catalogue', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();
