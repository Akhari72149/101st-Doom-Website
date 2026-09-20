create table if not exists public.discord_outbox_admin_actions (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null,
  event_type text not null,
  action text not null check (action in ('retry', 'remove')),
  acted_by uuid references public.app_auth_users(id) on delete set null,
  personnel_id uuid,
  error_snapshot text,
  acted_at timestamptz not null default now()
);

create index if not exists discord_outbox_admin_actions_event_idx
  on public.discord_outbox_admin_actions (outbox_event_id, acted_at desc);

alter table public.discord_outbox_admin_actions enable row level security;
revoke all on public.discord_outbox_admin_actions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.discord_outbox_admin_actions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.discord_outbox_admin_actions from authenticated;
  end if;
end;
$$;

create or replace function public.manage_dead_discord_outbox_event(
  target_event_id uuid,
  requested_action text,
  actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event record;
  current_discord_id text;
begin
  if requested_action not in ('retry', 'remove') then
    raise exception 'Invalid Discord outbox action';
  end if;

  select outbox.id, outbox.event_type, outbox.payload, outbox.last_error
    into target_event
  from public.discord_role_outbox outbox
  where outbox.id = target_event_id
    and outbox.status = 'dead'
  for update;

  if not found then
    return null;
  end if;

  insert into public.discord_outbox_admin_actions (
    outbox_event_id,
    event_type,
    action,
    acted_by,
    personnel_id,
    error_snapshot
  ) values (
    target_event.id,
    target_event.event_type,
    requested_action,
    actor_id,
    case
      when coalesce(target_event.payload ->> 'personnelId', '')
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then (target_event.payload ->> 'personnelId')::uuid
      else null
    end,
    target_event.last_error
  );

  if requested_action = 'remove' then
    delete from public.discord_role_outbox
    where id = target_event.id;
    return 'removed';
  end if;

  if coalesce(target_event.payload ->> 'personnelId', '')
      ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    select nullif(btrim(personnel.discord_id), '')
      into current_discord_id
    from public.personnel personnel
    where personnel.id = (target_event.payload ->> 'personnelId')::uuid;
  end if;

  update public.discord_role_outbox
  set payload = case
        when current_discord_id ~ '^[0-9]{17,20}$'
          then jsonb_set(payload, '{discordId}', to_jsonb(current_discord_id), true)
        else payload
      end,
      status = 'pending',
      attempt_count = 0,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      processed_at = null,
      last_error = null,
      updated_at = now()
  where id = target_event.id;

  return 'retried';
end;
$$;

revoke all on function public.manage_dead_discord_outbox_event(uuid, text, uuid) from public;
grant execute on function public.manage_dead_discord_outbox_event(uuid, text, uuid) to roster_app_runtime;
