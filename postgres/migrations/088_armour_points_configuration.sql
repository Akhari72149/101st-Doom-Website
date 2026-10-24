insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.armour-points-config', '/admin/armour-points-config', 'Armour Points Configuration', 'Personnel Admin',
        'Configure cumulative rank allocations and armour catalogue costs and rank requirements.')
on conflict (permission_key) do update
set page_path=excluded.page_path, label=excluded.label, category=excluded.category,
    description=excluded.description, updated_at=now();

insert into public.user_page_permissions (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.armour-points-config', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();

grant insert, update on public.armour_rank_point_values to roster_app_runtime;
grant update on public.armour_customisation_items to roster_app_runtime;

drop policy if exists "native runtime armour rank point configuration" on public.armour_rank_point_values;
create policy "native runtime armour rank point configuration" on public.armour_rank_point_values
  for all to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime armour catalogue configuration" on public.armour_customisation_items;
create policy "native runtime armour catalogue configuration" on public.armour_customisation_items
  for update to roster_app_runtime using (true) with check (true);
