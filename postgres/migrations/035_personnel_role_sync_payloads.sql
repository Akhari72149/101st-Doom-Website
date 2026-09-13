drop function if exists public.enqueue_slot_role_sync(uuid, text, text, boolean);

create function public.enqueue_slot_role_sync(
  target_personnel_id uuid,
  target_slot_id text,
  previous_slot_id text,
  use_default_role boolean,
  roles_to_add text[],
  roles_to_remove text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_discord_id text;
  queued_id uuid;
begin
  select discord_id into target_discord_id
  from public.personnel
  where id = target_personnel_id;

  if not found then
    raise exception 'Personnel record not found';
  end if;

  if nullif(btrim(target_discord_id), '') is null then
    return null;
  end if;

  if coalesce(cardinality(roles_to_add), 0) > 20
     or coalesce(cardinality(roles_to_remove), 0) > 20
     or exists (
       select 1 from unnest(coalesce(roles_to_add, array[]::text[])) role_id
       where role_id !~ '^[0-9]{16,22}$'
     )
     or exists (
       select 1 from unnest(coalesce(roles_to_remove, array[]::text[])) role_id
       where role_id !~ '^[0-9]{16,22}$'
     ) then
    raise exception 'Invalid Discord role IDs';
  end if;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'SLOT_ROLE_SYNC',
    jsonb_build_object(
      'discordId', target_discord_id,
      'personnelId', target_personnel_id,
      'slotId', target_slot_id,
      'oldSlotId', previous_slot_id,
      'forceDefaultRole', use_default_role,
      'roleIdsToAdd', to_jsonb(coalesce(roles_to_add, array[]::text[])),
      'roleIdsToRemove', to_jsonb(coalesce(roles_to_remove, array[]::text[]))
    )
  )
  returning id into queued_id;

  return queued_id;
end;
$$;

create or replace function public.enqueue_rank_role_sync(
  target_personnel_id uuid,
  previous_rank_id uuid,
  target_rank_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_discord_id text;
  previous_role_id text;
  target_role_id text;
  queued_id uuid;
begin
  select discord_id into target_discord_id
  from public.personnel
  where id = target_personnel_id;

  if not found then
    raise exception 'Personnel record not found';
  end if;

  if nullif(btrim(target_discord_id), '') is null then
    return null;
  end if;

  select discord_role_id into previous_role_id
  from public.ranks
  where id = previous_rank_id;

  select discord_role_id into target_role_id
  from public.ranks
  where id = target_rank_id;

  if (nullif(btrim(previous_role_id), '') is not null and previous_role_id !~ '^[0-9]{16,22}$')
     or (nullif(btrim(target_role_id), '') is not null and target_role_id !~ '^[0-9]{16,22}$') then
    raise exception 'Invalid Discord rank role ID';
  end if;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'RANK_ROLE_SYNC',
    jsonb_build_object(
      'discordId', target_discord_id,
      'personnelId', target_personnel_id,
      'oldRankId', previous_rank_id,
      'newRankId', target_rank_id,
      'oldRoleId', previous_role_id,
      'newRoleId', target_role_id
    )
  )
  returning id into queued_id;

  return queued_id;
end;
$$;

revoke all on function public.enqueue_slot_role_sync(uuid, text, text, boolean, text[], text[]) from public;
revoke all on function public.enqueue_rank_role_sync(uuid, uuid, uuid) from public;

grant execute on function public.enqueue_slot_role_sync(uuid, text, text, boolean, text[], text[]) to roster_app_runtime;
grant execute on function public.enqueue_rank_role_sync(uuid, uuid, uuid) to roster_app_runtime;
