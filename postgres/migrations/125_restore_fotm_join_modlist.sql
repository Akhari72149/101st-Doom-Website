alter table public.join_page_links
  drop constraint if exists join_page_links_link_key_check;

alter table public.join_page_links
  add constraint join_page_links_link_key_check
  check (link_key in ('main-operations', 'fun-operations', 'fotm', 'unit-whitelist'));

insert into public.join_page_links (link_key, label, url)
values (
  'fotm',
  'FOTM Modlist',
  'https://cdn.discordapp.com/attachments/983174143400869898/1464716029312630987/101st_FOTM_40k_Rubicon.html?ex=69a3f65a&is=69a2a4da&hm=afb618de63df40618b068742e8af922f4d356dc14ec4a91018104ce5c9d9aae3&'
)
on conflict (link_key) do update
set label = excluded.label;

update public.app_page_permissions
set description = 'Upload the public MainOp, FunOp, and FOTM modlists and maintain the unit whitelist link.',
    updated_at = now()
where permission_key = 'admin.join-links';
