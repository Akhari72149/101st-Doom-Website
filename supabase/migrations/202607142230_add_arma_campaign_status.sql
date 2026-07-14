create table if not exists public.arma_campaign_status_current (
  server_id text not null,
  mission_id text not null,
  campaign_id text not null default 'operation-last-stand',
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  world text,
  player_count integer not null default 0,
  global_infection numeric(5,2),
  research_data integer not null default 0,
  safehouse_count integer not null default 0,
  unlocked_safehouse_count integer not null default 0,
  active_horde_count integer not null default 0,
  safehouse_siege_active boolean not null default false,
  story_week integer not null default 1,
  story_active_count integer not null default 0,
  story_complete_count integer not null default 0,
  story_evidence_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (server_id, mission_id, campaign_id)
);

create table if not exists public.arma_campaign_status_history (
  id bigint generated always as identity primary key,
  server_id text not null,
  mission_id text not null,
  campaign_id text not null default 'operation-last-stand',
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  world text,
  player_count integer not null default 0,
  global_infection numeric(5,2),
  research_data integer not null default 0,
  safehouse_count integer not null default 0,
  unlocked_safehouse_count integer not null default 0,
  active_horde_count integer not null default 0,
  safehouse_siege_active boolean not null default false,
  story_week integer not null default 1,
  story_active_count integer not null default 0,
  story_complete_count integer not null default 0,
  story_evidence_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists arma_campaign_status_history_lookup_idx
  on public.arma_campaign_status_history (campaign_id, server_id, mission_id, received_at desc);

alter table public.arma_campaign_status_current enable row level security;
alter table public.arma_campaign_status_history enable row level security;

revoke all on table public.arma_campaign_status_current from anon, authenticated;
revoke all on table public.arma_campaign_status_history from anon, authenticated;

grant select, insert, update, delete on table public.arma_campaign_status_current to service_role;
grant select, insert, update, delete on table public.arma_campaign_status_history to service_role;
grant usage, select on sequence public.arma_campaign_status_history_id_seq to service_role;
