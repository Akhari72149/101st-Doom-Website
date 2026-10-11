alter table public.join_page_links
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_sha256 text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists uploaded_by uuid references public.app_auth_users(id) on delete set null;

delete from public.join_page_links
where link_key in ('training', 'fotm');

alter table public.join_page_links
  drop constraint if exists join_page_links_link_key_check;

alter table public.join_page_links
  add constraint join_page_links_link_key_check
  check (link_key in ('main-operations', 'fun-operations', 'unit-whitelist'));

update public.join_page_links
set label = 'Main Operations Modlist'
where link_key = 'main-operations';

update public.join_page_links
set label = 'Fun Operation Modlist'
where link_key = 'fun-operations';

grant select,
      update (url, updated_at, updated_by, file_name, file_size_bytes, file_sha256, uploaded_at, uploaded_by)
on public.join_page_links to roster_app_runtime;

update public.app_page_permissions
set label = 'Join Page Content',
    description = 'Upload the public MainOp and FunOp modlists and maintain the unit whitelist link.',
    updated_at = now()
where permission_key = 'admin.join-links';
