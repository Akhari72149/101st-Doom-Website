-- Website-side campaign story metadata only. This does not send commands to Arma.

-- If the earlier command-objective experiment was applied anywhere, remove it.
drop table if exists public.arma_campaign_objectives cascade;
drop function if exists public.set_arma_campaign_objectives_updated_at() cascade;

-- Keep only one status-history row per server/mission/campaign. The API upserts this row.
with ranked_history as (
  select
    id,
    row_number() over (
      partition by server_id, mission_id, campaign_id
      order by received_at desc, id desc
    ) as row_number
  from public.arma_campaign_status_history
)
delete from public.arma_campaign_status_history history
using ranked_history ranked
where history.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists arma_campaign_status_history_single_row_idx
  on public.arma_campaign_status_history (server_id, mission_id, campaign_id);

create table if not exists public.arma_campaign_story_episodes (
  id bigint generated always as identity primary key,
  campaign_id text not null default 'operation-last-stand',
  week_number integer not null,
  title text not null,
  summary text not null,
  status text not null default 'active' check (status in ('locked', 'active', 'complete', 'archived')),
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, week_number)
);

create table if not exists public.arma_campaign_story_objectives (
  id text primary key,
  campaign_id text not null default 'operation-last-stand',
  week_number integer not null,
  size text not null check (size in ('SMALL', 'BIG')),
  title text not null,
  description text not null,
  marker text not null,
  implementation_note text not null,
  action jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  status text not null default 'available' check (status in ('available', 'active', 'complete', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, week_number)
    references public.arma_campaign_story_episodes (campaign_id, week_number)
    on delete cascade
);

create index if not exists arma_campaign_story_objectives_lookup_idx
  on public.arma_campaign_story_objectives (campaign_id, week_number, sort_order asc);

create or replace function public.set_arma_campaign_story_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_arma_campaign_story_episodes_updated_at on public.arma_campaign_story_episodes;
create trigger set_arma_campaign_story_episodes_updated_at
before update on public.arma_campaign_story_episodes
for each row
execute function public.set_arma_campaign_story_updated_at();

drop trigger if exists set_arma_campaign_story_objectives_updated_at on public.arma_campaign_story_objectives;
create trigger set_arma_campaign_story_objectives_updated_at
before update on public.arma_campaign_story_objectives
for each row
execute function public.set_arma_campaign_story_updated_at();

insert into public.arma_campaign_story_episodes
  (campaign_id, week_number, title, summary, status)
values
  (
    'operation-last-stand',
    1,
    'Echoes on Altis',
    'A dead Republic distress loop is bleeding through the old Altis comms grid. The 101st Doom Battalion has deployed to identify the source, secure survivors, and determine why the infected are moving toward the signal.',
    'active'
  )
on conflict (campaign_id, week_number) do update set
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  updated_at = now();

insert into public.arma_campaign_story_objectives
  (id, campaign_id, week_number, size, title, description, marker, implementation_note, action, sort_order, status)
values
  (
    'w1_radio_trace',
    'operation-last-stand',
    1,
    'SMALL',
    'Trace the Dead Signal',
    'Investigate abnormal radio traffic near a secured safehouse. The signal repeats clone authentication tags that should have expired months ago.',
    'story_radio_1',
    'Spawns a traceable long-range radio at story_radio_1.',
    '["SPAWN_OBJECT", "Land_PortableLongRangeRadio_F", "Trace Signal", "The dead signal has been traced. Command can triangulate the relay."]'::jsonb,
    10,
    'available'
  ),
  (
    'w1_recon_datapads',
    'operation-last-stand',
    1,
    'SMALL',
    'Recover Recon Datapads',
    'Recover scattered recon datapads from the first 101st survey team.',
    'story_recon_1',
    'Spawns 5 datapads around story_recon_1.',
    '["SPAWN_OBJECTS", "Land_File1_F", 5, 70, "Recover Datapad", "The recon datapads are recovered. The survey team found a relay pattern under the infection routes."]'::jsonb,
    20,
    'available'
  ),
  (
    'w1_signal_relay',
    'operation-last-stand',
    1,
    'BIG',
    'Silence the First Relay',
    'Locate the relay rebroadcasting the distress loop and shut it down before the signal draws a larger horde.',
    'story_relay_1',
    'Spawns a relay console/object at story_relay_1.',
    '["SPAWN_OBJECT", "Land_DataTerminal_01_F", "Shut Down Relay", "The first relay is silent. The infected briefly lose coordination across the AO."]'::jsonb,
    30,
    'available'
  )
on conflict (id) do update set
  campaign_id = excluded.campaign_id,
  week_number = excluded.week_number,
  size = excluded.size,
  title = excluded.title,
  description = excluded.description,
  marker = excluded.marker,
  implementation_note = excluded.implementation_note,
  action = excluded.action,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

alter table public.arma_campaign_story_episodes enable row level security;
alter table public.arma_campaign_story_objectives enable row level security;

revoke all on table public.arma_campaign_story_episodes from anon, authenticated;
revoke all on table public.arma_campaign_story_objectives from anon, authenticated;

grant select, insert, update, delete on table public.arma_campaign_story_episodes to service_role;
grant select, insert, update, delete on table public.arma_campaign_story_objectives to service_role;
grant usage, select on sequence public.arma_campaign_story_episodes_id_seq to service_role;
