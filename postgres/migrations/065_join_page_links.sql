create table if not exists public.join_page_links (
  link_key text primary key check (link_key in (
    'main-operations',
    'training',
    'fun-operations',
    'fotm',
    'unit-whitelist'
  )),
  label text not null,
  url text not null check (url ~ '^https?://'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_auth_users(id) on delete set null
);

insert into public.join_page_links (link_key, label, url)
values
  ('main-operations', 'Main Operations Modlist', 'https://cdn.discordapp.com/attachments/1284402204748546114/1471514051950546995/Yoaboa_V2.html?ex=69a44dc1&is=69a2fc41&hm=49e5d6f3aa76a25df6f05c45caa25c409fb46ddf4d09bb255d42f3638bb8a110&'),
  ('training', 'Training Modlist', 'https://cdn.discordapp.com/attachments/1284402204748546114/1471514051463876649/Training_Server_Modlist_V2.html?ex=69a44dc1&is=69a2fc41&hm=aefc731a0722aa326446839465e28a8fb57ba1c899d9d8a67900c7efcd2431b0&'),
  ('fun-operations', 'Fun Operation Modlist', 'https://cdn.discordapp.com/attachments/1284402204748546114/1471514051036188756/Funop_Modlist_V5.html?ex=69a44dc1&is=69a2a4da&hm=00bd71791d9fe0b992652f1059345ec4e48c00210af1a93a972ad094bedd3b5f&'),
  ('fotm', 'FOTM Modlist (WH 40k)', 'https://cdn.discordapp.com/attachments/983174143400869898/1464716029312630987/101st_FOTM_40k_Rubicon.html?ex=69a3f65a&is=69a2a4da&hm=afb618de63df40618b068742e8af922f4d356dc14ec4a91018104ce5c9d9aae3&'),
  ('unit-whitelist', 'Official Unit Whitelist', 'https://steamcommunity.com/sharedfiles/filedetails/?id=3150345662')
on conflict (link_key) do nothing;

alter table public.join_page_links enable row level security;
revoke all on public.join_page_links from public;
grant select, update (url, updated_at, updated_by) on public.join_page_links to roster_app_runtime;

drop policy if exists "native runtime join page link reads" on public.join_page_links;
create policy "native runtime join page link reads"
  on public.join_page_links for select to roster_app_runtime using (true);

drop policy if exists "native runtime join page link updates" on public.join_page_links;
create policy "native runtime join page link updates"
  on public.join_page_links for update to roster_app_runtime
  using (true)
  with check (true);

insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.join-links', '/admin/join-links', 'Join Page Links', 'Systems',
   'Review and update the modlist and whitelist links displayed on the public Join page.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.join-links', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full',
    granted_by = excluded.granted_by,
    updated_at = now();
