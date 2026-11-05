alter table public.server_control_jobs
  drop constraint if exists server_control_jobs_action_check;

alter table public.server_control_jobs
  add constraint server_control_jobs_action_check check (action in (
    'server.start', 'server.stop', 'server.restart',
    'steamcmd.server.update', 'steamcmd.mods.update', 'mods.keys.copy'
  ));

