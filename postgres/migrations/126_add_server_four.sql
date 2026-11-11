alter table public.server_control_jobs
  drop constraint if exists server_control_jobs_server_id_check;

alter table public.server_control_jobs
  add constraint server_control_jobs_server_id_check
  check (server_id between 1 and 4);

alter table public.server_control_mod_presets
  drop constraint if exists server_control_mod_presets_preset_key_check;

alter table public.server_control_mod_presets
  add constraint server_control_mod_presets_preset_key_check
  check (preset_key in ('main', 'fun', 'fotm'));

insert into public.server_control_mod_presets (preset_key, display_name, workshop_mod_ids)
values ('fotm', 'Server 4', '[]'::jsonb)
on conflict (preset_key) do update
set display_name = excluded.display_name;

delete from public.recurring_server_blocks
where server_id = 4
  and title in (
    'Claymore 2 Main Operation',
    'Dagger Main Operation',
    'Broadsword 3 Main Operation',
    'Tomahawk 1 Main Operation'
  );

insert into public.recurring_server_blocks (id, server_id, title, start_at, end_at, recurrence)
select gen_random_uuid(), 4, title, start_at, end_at, recurrence
from public.recurring_server_blocks
where server_id = 1
  and title in (
    'Claymore 2 Main Operation',
    'Dagger Main Operation',
    'Broadsword 3 Main Operation',
    'Tomahawk 1 Main Operation'
  );
