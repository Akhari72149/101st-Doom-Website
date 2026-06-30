create table if not exists public.personnel_discord_verification_challenges (
  id uuid primary key default gen_random_uuid(),

  steam_link_session_id uuid not null
    references public.steam_link_sessions(id)
    on delete cascade,

  personnel_id uuid not null
    references public.personnel(id)
    on delete cascade,

  discord_user_id text not null,
  code_hash text not null,

  status text not null default 'PENDING'
    constraint personnel_discord_verification_status_check
    check (
      status in (
        'PENDING',
        'SENT',
        'VERIFIED',
        'EXPIRED',
        'FAILED'
      )
    ),

  failed_attempts integer not null default 0,
  max_attempts integer not null default 5,

  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  delivered_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz not null,

  delivery_error text,

  constraint personnel_discord_verification_expiry_check
    check (expires_at > created_at),

  constraint personnel_discord_verification_attempts_check
    check (
      failed_attempts >= 0
      and max_attempts > 0
      and failed_attempts <= max_attempts
    )
);

create index if not exists personnel_discord_verification_session_idx
  on public.personnel_discord_verification_challenges (steam_link_session_id);

create index if not exists personnel_discord_verification_personnel_idx
  on public.personnel_discord_verification_challenges (personnel_id);

create index if not exists personnel_discord_verification_status_idx
  on public.personnel_discord_verification_challenges (status);

create index if not exists personnel_discord_verification_expires_idx
  on public.personnel_discord_verification_challenges (expires_at);

create unique index if not exists personnel_discord_verification_one_active_session_idx
  on public.personnel_discord_verification_challenges (steam_link_session_id)
  where status in ('PENDING', 'SENT');

alter table public.personnel_discord_verification_challenges enable row level security;

revoke all on public.personnel_discord_verification_challenges from anon;
revoke all on public.personnel_discord_verification_challenges from authenticated;
grant all on public.personnel_discord_verification_challenges to service_role;

alter table public.personnel_steam_links
  add column if not exists steam_display_name text,
  add column if not exists steam_profile_url text,
  add column if not exists steam_avatar_url text;

create unique index if not exists personnel_steam_links_one_active_steam_idx
  on public.personnel_steam_links (steam_id)
  where revoked_at is null;

create unique index if not exists personnel_steam_links_one_active_personnel_idx
  on public.personnel_steam_links (personnel_id)
  where revoked_at is null;

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
      and t.relname = 'personnel_steam_link_audit'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%action%'
  loop
    execute format(
      'alter table public.personnel_steam_link_audit drop constraint if exists %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.personnel_steam_link_audit
  add constraint personnel_steam_link_audit_action_check
  check (
    length(btrim(action)) > 0
    and (
      action in (
        'STEAM_AUTH_STARTED',
        'STEAM_AUTH_VERIFIED',
        'PROFILE_SELECTED',
        'DISCORD_CODE_SENT',
        'DISCORD_CODE_SEND_FAILED',
        'DISCORD_CODE_FAILED',
        'DISCORD_CODE_VERIFIED',
        'REVIEW_REQUESTED',
        'LINK_APPROVED',
        'LINK_REJECTED',
        'LINK_REVOKED'
      )
      or action = upper(action)
    )
  );

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
begin
  select *
    into session_row
  from public.steam_link_sessions
  where id = p_steam_link_session_id
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
  from public.personnel_discord_verification_challenges
  where id = p_discord_challenge_id
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
    from public.personnel_steam_links
    where steam_id = session_row.steam_id
      and revoked_at is null
  ) then
    raise exception 'STEAM_ALREADY_LINKED';
  end if;

  if exists (
    select 1
    from public.personnel_steam_links
    where personnel_id = session_row.selected_personnel_id
      and revoked_at is null
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
  returning id into new_link_id;

  update public.personnel_discord_verification_challenges
  set status = 'VERIFIED',
      verified_at = now()
  where id = challenge_row.id;

  update public.steam_link_sessions
  set consumed_at = now()
  where id = session_row.id;

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
    session_row.selected_personnel_id,
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
  personnel_id := session_row.selected_personnel_id;
  return next;
end;
$$;

revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from public;
revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from anon;
revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from authenticated;
grant execute on function public.finalize_steam_link_from_discord(uuid, uuid) to service_role;
