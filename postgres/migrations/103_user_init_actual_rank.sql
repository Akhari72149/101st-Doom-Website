create or replace function public.notify_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_rank_role_id text;
  known_rank_role_ids jsonb;
begin
  if nullif(btrim(new.discord_id), '') is null
     or new.auto_role_sync is not true then
    return new;
  end if;

  select ranks.discord_role_id
    into target_rank_role_id
  from public.ranks ranks
  where ranks.id = new.rank_id;

  select coalesce(jsonb_agg(ranks.discord_role_id), '[]'::jsonb)
    into known_rank_role_ids
  from public.ranks ranks
  where nullif(btrim(ranks.discord_role_id), '') is not null;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'USER_ROLE_INIT',
    jsonb_build_object(
      'discordId', new.discord_id,
      'personnelId', new.id,
      'rankId', new.rank_id,
      'rankRoleId', target_rank_role_id,
      'rankRoleIds', known_rank_role_ids,
      'reconcileRank', true
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_user_created() from public;

-- Upgrade unprocessed legacy initialisation events to carry the current rank.
update public.discord_role_outbox outbox
   set payload = outbox.payload || jsonb_build_object(
         'personnelId', personnel.id,
         'rankId', personnel.rank_id,
         'rankRoleId', ranks.discord_role_id,
         'rankRoleIds', known.role_ids,
         'reconcileRank', true
       ),
       updated_at = now()
  from public.personnel personnel
  left join public.ranks ranks on ranks.id = personnel.rank_id
 cross join lateral (
   select coalesce(jsonb_agg(all_ranks.discord_role_id), '[]'::jsonb) role_ids
   from public.ranks all_ranks
   where nullif(btrim(all_ranks.discord_role_id), '') is not null
 ) known
 where outbox.event_type = 'USER_ROLE_INIT'
   and outbox.status = 'pending'
   and outbox.payload->>'discordId' = personnel.discord_id;
