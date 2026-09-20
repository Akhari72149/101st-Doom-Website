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

  select nullif(btrim(discord_role_id), '') into previous_role_id
  from public.ranks
  where id = previous_rank_id;

  select nullif(btrim(discord_role_id), '') into target_role_id
  from public.ranks
  where id = target_rank_id;

  if previous_role_id is not distinct from target_role_id then
    return null;
  end if;

  if (previous_role_id is not null and previous_role_id !~ '^[0-9]{16,22}$')
     or (target_role_id is not null and target_role_id !~ '^[0-9]{16,22}$') then
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

revoke all on function public.enqueue_rank_role_sync(uuid, uuid, uuid) from public;
grant execute on function public.enqueue_rank_role_sync(uuid, uuid, uuid) to roster_app_runtime;

update public.discord_role_outbox
set status = 'succeeded',
    processed_at = now(),
    last_error = null,
    updated_at = now()
where event_type = 'RANK_ROLE_SYNC'
  and status = 'pending'
  and nullif(btrim(payload ->> 'oldRoleId'), '')
      is not distinct from nullif(btrim(payload ->> 'newRoleId'), '');
