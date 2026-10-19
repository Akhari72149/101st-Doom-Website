create table if not exists public.mod_pipeline_repositories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  web_url text not null unique,
  default_branch text not null default 'main',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mod_pipeline_repository_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  repository_id uuid not null references public.mod_pipeline_repositories(id) on delete restrict,
  reference_type text not null check (reference_type in ('issue','branch','pull_request','commit','other')),
  reference text not null,
  url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(task_id,repository_id,reference_type,reference)
);

create table if not exists public.mod_pipeline_assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  sha256 text not null,
  contents bytea not null,
  caption text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists mod_pipeline_repository_links_task_idx on public.mod_pipeline_repository_links(task_id,created_at);
create index if not exists mod_pipeline_assets_task_idx on public.mod_pipeline_assets(task_id,uploaded_at);

grant select,insert,update,delete on public.mod_pipeline_repositories,
  public.mod_pipeline_repository_links,public.mod_pipeline_assets to roster_app_runtime;

do $$
declare table_name text;
begin
  foreach table_name in array array['mod_pipeline_repositories','mod_pipeline_repository_links','mod_pipeline_assets']
  loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I','native runtime '||replace(table_name,'_',' '),table_name);
    execute format('create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)',
      'native runtime '||replace(table_name,'_',' '),table_name);
  end loop;
end $$;
