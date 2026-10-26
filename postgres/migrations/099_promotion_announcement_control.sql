create table if not exists public.promotion_announcement_settings (
  singleton boolean primary key default true check (singleton),
  announcements_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_auth_users(id) on delete set null
);

insert into public.promotion_announcement_settings(singleton, announcements_enabled)
values(true, false)
on conflict (singleton) do nothing;

alter table public.promotion_announcement_settings enable row level security;
revoke all on public.promotion_announcement_settings from public;
grant select, update on public.promotion_announcement_settings to roster_app_runtime;

drop policy if exists promotion_announcement_runtime_access
  on public.promotion_announcement_settings;
create policy promotion_announcement_runtime_access
  on public.promotion_announcement_settings
  for all to roster_app_runtime
  using (true)
  with check (singleton);
