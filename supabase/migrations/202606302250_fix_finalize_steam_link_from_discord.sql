alter table public.personnel_steam_links
  add column if not exists steam_display_name text,
  add column if not exists steam_profile_url text,
  add column if not exists steam_avatar_url text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'personnel_steam_links'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%linked_method%'
  loop
    execute format(
      'alter table public.personnel_steam_links drop constraint if exists %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.personnel_steam_links
  add constraint personnel_steam_links_linked_method_check
  check (linked_method in ('CLAIM_CODE', 'STAFF_APPROVAL', 'DISCORD_CODE'));

create or replace function public.finalize_steam_link_from_discord(
  p_steam_link_session_id uuid,
  p_discord_challenge_id uuid
)
returns table (
  link_id uuid,
  personnel_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.steam_link_sessions%rowtype;
  challenge_row public.personnel_discord_verification_challenges%rowtype;
  new_link_id uuid;
  finalized_personnel_id uuid;
begin
  select *
  into session_row
  from public.steam_link_sessions as sls
  where sls.id = p_steam_link_session_id
  for update;

  if not found then
    raise exception 'INVALID_SESSION';
  end if;

  if session_row.steam_id is null
    or session_row.verified_at is null
    or session_row.consumed_at is not null
    or session_row.expires_at <= now()
    or session_row.selected_personnel_id is null then
    raise exception 'INVALID_SESSION';
  end if;

  select *
  into challenge_row
  from public.personnel_discord_verification_challenges as challenge
  where challenge.id = p_discord_challenge_id
  for update;

  if not found then
    raise exception 'INVALID_CHALLENGE';
  end if;

  if challenge_row.steam_link_session_id <> session_row.id
    or challenge_row.personnel_id <> session_row.selected_personnel_id
    or challenge_row.status <> 'SENT'
    or challenge_row.expires_at <= now()
    or challenge_row.failed_attempts >= challenge_row.max_attempts then
    raise exception 'INVALID_CHALLENGE';
  end if;

  if exists (
    select 1
    from public.personnel_steam_links as link
    where link.steam_id = session_row.steam_id
      and link.revoked_at is null
  ) then
    raise exception 'STEAM_ALREADY_LINKED';
  end if;

  if exists (
    select 1
    from public.personnel_steam_links as link
    where link.personnel_id = session_row.selected_personnel_id
      and link.revoked_at is null
  ) then
    raise exception 'PERSONNEL_ALREADY_LINKED';
  end if;

  insert into public.personnel_steam_links (
    personnel_id,
    steam_id,
    linked_method,
    linked_at,
    steam_display_name,
    steam_profile_url,
    steam_avatar_url
  )
  values (
    session_row.selected_personnel_id,
    session_row.steam_id,
    'DISCORD_CODE',
    now(),
    session_row.steam_display_name,
    session_row.steam_profile_url,
    session_row.steam_avatar_url
  )
  returning id, public.personnel_steam_links.personnel_id
  into new_link_id, finalized_personnel_id;

  update public.personnel_discord_verification_challenges as challenge
  set status = 'VERIFIED',
      verified_at = now()
  where challenge.id = challenge_row.id;

  update public.steam_link_sessions as sls
  set consumed_at = now()
  where sls.id = session_row.id;

  insert into public.personnel_steam_link_audit (
    action,
    personnel_id,
    steam_id,
    link_id,
    actor_type,
    details
  )
  values (
    'LINK_APPROVED',
    finalized_personnel_id,
    session_row.steam_id,
    new_link_id,
    'website',
    jsonb_build_object(
      'method', 'DISCORD_CODE',
      'challenge_id', challenge_row.id,
      'steam_link_session_id', session_row.id
    )
  );

  link_id := new_link_id;
  personnel_id := finalized_personnel_id;
  return next;
end;
$$;

revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from public;
revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from anon;
revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from authenticated;
grant execute on function public.finalize_steam_link_from_discord(uuid, uuid) to service_role;
