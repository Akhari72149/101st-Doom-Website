create or replace function public.enqueue_personnel_discord_import(
  target_personnel_id uuid
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

  if coalesce(target_discord_id, '') !~ '^[0-9]{17,20}$' then
    raise exception 'Personnel record has an invalid Discord ID';
  end if;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'USER_FULL_IMPORT',
    jsonb_build_object(
      'discordId', target_discord_id,
      'personnelId', target_personnel_id
    )
  )
  returning id into queued_id;

  return queued_id;
end;
$$;

revoke all on function public.enqueue_personnel_discord_import(uuid) from public;
grant execute on function public.enqueue_personnel_discord_import(uuid) to roster_app_runtime;
