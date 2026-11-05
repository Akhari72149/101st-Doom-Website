alter table public.server_control_jobs
  drop constraint if exists server_control_jobs_action_check;

alter table public.server_control_jobs
  add constraint server_control_jobs_action_check check (action in (
    'server.start', 'server.stop', 'server.restart',
    'steamcmd.server.update', 'steamcmd.mods.update', 'mods.keys.copy',
    'steamcmd.server.update_all', 'steamcmd.mods.update_all'
  ));

create unique index if not exists server_control_one_active_global_action_idx
  on public.server_control_jobs (agent_id)
  where status in ('pending', 'processing') and server_id is null;

create table if not exists public.server_control_mod_presets (
  preset_key text primary key check (preset_key in ('main', 'fun')),
  display_name text not null,
  workshop_mod_ids jsonb not null default '[]'::jsonb,
  updated_by uuid references public.app_auth_users(id) on delete set null,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(workshop_mod_ids) = 'array')
);

alter table public.server_control_mod_presets enable row level security;
revoke all on public.server_control_mod_presets from public;
grant select, insert, update on public.server_control_mod_presets to roster_app_runtime;
grant select on public.server_control_mod_presets to roster_app_backup;

drop policy if exists "runtime server mod presets" on public.server_control_mod_presets;
create policy "runtime server mod presets" on public.server_control_mod_presets
  for all to roster_app_runtime using (true) with check (true);
