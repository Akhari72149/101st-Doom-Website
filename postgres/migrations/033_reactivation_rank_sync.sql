create or replace function public.enqueue_personnel_reactivation(target_personnel_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_discord_id text;
  target_rank_id uuid;
  target_rank_role_id text;
  known_rank_role_ids jsonb;
  queued_count integer := 0;
  certification record;
begin
  select personnel.discord_id, personnel.rank_id, ranks.discord_role_id
    into target_discord_id, target_rank_id, target_rank_role_id
  from public.personnel personnel
  left join public.ranks ranks on ranks.id = personnel.rank_id
  where personnel.id = target_personnel_id
    and lower(coalesce(personnel.status, '')) not in ('removed', 'retired', 'transferred');

  if not found or nullif(btrim(target_discord_id), '') is null then
    return 0;
  end if;

  select coalesce(jsonb_agg(ranks.discord_role_id), '[]'::jsonb)
    into known_rank_role_ids
  from public.ranks ranks
  where nullif(btrim(ranks.discord_role_id), '') is not null;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'USER_ROLE_INIT',
    jsonb_build_object(
      'discordId', target_discord_id,
      'rankId', target_rank_id,
      'rankRoleId', target_rank_role_id,
      'rankRoleIds', known_rank_role_ids,
      'reactivation', true
    )
  );
  queued_count := queued_count + 1;

  for certification in
    select definitions.cert_id
    from public.personnel_certifications awarded
    join public.certifications definitions on definitions.id = awarded.certification_id
    where awarded.personnel_id = target_personnel_id
      and nullif(btrim(definitions.cert_id), '') is not null
  loop
    insert into public.discord_role_outbox (event_type, payload)
    values (
      'CERT_ROLE_SYNC',
      jsonb_build_object(
        'discordId', target_discord_id,
        'roleId', certification.cert_id,
        'action', 'assign'
      )
    );
    queued_count := queued_count + 1;
  end loop;

  return queued_count;
end;
$$;

revoke all on function public.enqueue_personnel_reactivation(uuid) from public;
grant execute on function public.enqueue_personnel_reactivation(uuid) to roster_app_runtime;
