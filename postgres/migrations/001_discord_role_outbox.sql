create table if not exists public.discord_role_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('CERT_ROLE_SYNC', 'USER_ROLE_INIT', 'PERSONNEL_STATUS_SYNC')
  ),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'succeeded', 'dead')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discord_role_outbox_pending_idx
  on public.discord_role_outbox (available_at, created_at)
  where status = 'pending';

alter table public.discord_role_outbox enable row level security;
revoke all on public.discord_role_outbox from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.discord_role_outbox from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.discord_role_outbox from authenticated;
  end if;
end;
$$;

create or replace function public.notify_cert_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_discord_id text;
  target_role_id text;
begin
  select p.discord_id into target_discord_id
  from public.personnel p
  where p.id = coalesce(new.personnel_id, old.personnel_id);

  select c.cert_id into target_role_id
  from public.certifications c
  where c.id = coalesce(new.certification_id, old.certification_id);

  if nullif(btrim(target_discord_id), '') is not null
     and nullif(btrim(target_role_id), '') is not null then
    insert into public.discord_role_outbox (event_type, payload)
    values (
      'CERT_ROLE_SYNC',
      jsonb_build_object(
        'discordId', target_discord_id,
        'roleId', target_role_id,
        'action', case when tg_op = 'DELETE' then 'revoke' else 'assign' end
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.notify_user_created()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(new.discord_id), '') is not null
     and new.auto_role_sync is true then
    insert into public.discord_role_outbox (event_type, payload)
    values (
      'USER_ROLE_INIT',
      jsonb_build_object('discordId', new.discord_id, 'rankId', new.rank_id)
    );
  end if;

  return new;
end;
$$;

create or replace function public.sync_personnel_discord_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(coalesce(new.status, '')) not in ('removed', 'retired') then
    return new;
  end if;

  if nullif(btrim(new.discord_id), '') is not null then
    insert into public.discord_role_outbox (event_type, payload)
    values (
      'PERSONNEL_STATUS_SYNC',
      jsonb_build_object(
        'personnelId', new.id,
        'discordId', new.discord_id,
        'status', lower(new.status)
      )
    );
  end if;

  return new;
end;
$$;
