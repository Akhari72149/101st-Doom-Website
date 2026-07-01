create table if not exists public.personnel_xp_profiles (
  personnel_id uuid primary key
    references public.personnel(id)
    on delete cascade,

  total_xp integer not null default 0
    constraint personnel_xp_profiles_total_xp_check
    check (total_xp >= 0),

  current_level integer not null default 1
    constraint personnel_xp_profiles_current_level_check
    check (current_level >= 1),

  lifetime_kill_count integer not null default 0
    constraint personnel_xp_profiles_lifetime_kill_count_check
    check (lifetime_kill_count >= 0),

  lifetime_death_count integer not null default 0
    constraint personnel_xp_profiles_lifetime_death_count_check
    check (lifetime_death_count >= 0),

  lifetime_teamkill_count integer not null default 0
    constraint personnel_xp_profiles_lifetime_teamkill_count_check
    check (lifetime_teamkill_count >= 0),

  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personnel_xp_weekly_stats (
  personnel_id uuid primary key
    references public.personnel(id)
    on delete cascade,

  week_start_date date not null,
  week_end_at timestamptz not null,

  week_xp integer not null default 0,
  week_positive_xp integer not null default 0,
  week_negative_xp integer not null default 0,
  week_kill_count integer not null default 0,
  week_death_count integer not null default 0,
  week_teamkill_count integer not null default 0,

  infantry_kill_count integer not null default 0,
  specialist_kill_count integer not null default 0,
  static_weapon_kill_count integer not null default 0,
  light_vehicle_kill_count integer not null default 0,
  vehicle_kill_count integer not null default 0,
  apc_ifv_kill_count integer not null default 0,
  tank_kill_count integer not null default 0,
  aircraft_kill_count integer not null default 0,
  unknown_kill_count integer not null default 0,

  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personnel_xp_weekly_stats_week_xp_check
    check (week_xp >= 0),
  constraint personnel_xp_weekly_stats_week_positive_xp_check
    check (week_positive_xp >= 0),
  constraint personnel_xp_weekly_stats_week_negative_xp_check
    check (week_negative_xp <= 0),
  constraint personnel_xp_weekly_stats_counts_check
    check (
      week_kill_count >= 0
      and week_death_count >= 0
      and week_teamkill_count >= 0
      and infantry_kill_count >= 0
      and specialist_kill_count >= 0
      and static_weapon_kill_count >= 0
      and light_vehicle_kill_count >= 0
      and vehicle_kill_count >= 0
      and apc_ifv_kill_count >= 0
      and tank_kill_count >= 0
      and aircraft_kill_count >= 0
      and unknown_kill_count >= 0
    )
);

create table if not exists public.arma_xp_event_receipts (
  event_uid text primary key,

  personnel_id uuid not null
    references public.personnel(id)
    on delete cascade,

  steam_id text not null,
  event_type text not null
    constraint arma_xp_event_receipts_event_type_check
    check (event_type in ('KILL', 'DEATH', 'OBJECTIVE', 'MISSION_COMPLETE')),

  xp_delta integer not null,
  server_id text not null,
  mission_id text not null,
  week_start_date date not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists personnel_xp_profiles_total_xp_idx
  on public.personnel_xp_profiles (total_xp desc);

create index if not exists personnel_xp_weekly_stats_week_xp_idx
  on public.personnel_xp_weekly_stats (week_xp desc);

create index if not exists arma_xp_event_receipts_personnel_week_idx
  on public.arma_xp_event_receipts (personnel_id, week_start_date);

create index if not exists arma_xp_event_receipts_created_idx
  on public.arma_xp_event_receipts (created_at);

alter table public.personnel_xp_profiles enable row level security;
alter table public.personnel_xp_weekly_stats enable row level security;
alter table public.arma_xp_event_receipts enable row level security;

revoke all on public.personnel_xp_profiles from anon;
revoke all on public.personnel_xp_profiles from authenticated;
grant all on public.personnel_xp_profiles to service_role;

revoke all on public.personnel_xp_weekly_stats from anon;
revoke all on public.personnel_xp_weekly_stats from authenticated;
grant all on public.personnel_xp_weekly_stats to service_role;

revoke all on public.arma_xp_event_receipts from anon;
revoke all on public.arma_xp_event_receipts from authenticated;
grant all on public.arma_xp_event_receipts to service_role;

create or replace function public.calculate_arma_xp_level(p_total_xp integer)
returns integer
language sql
immutable
as $function$
  select coalesce(max(level_value), 1)
  from (
    values
      (1, 0),
      (2, 100),
      (3, 250),
      (4, 450),
      (5, 700),
      (6, 1000),
      (7, 1350),
      (8, 1750),
      (9, 2200),
      (10, 2700),
      (11, 3250),
      (12, 3850),
      (13, 4500),
      (14, 5200),
      (15, 5950),
      (16, 6750),
      (17, 7600),
      (18, 8500),
      (19, 9450),
      (20, 10450),
      (21, 11500)
  ) as thresholds(level_value, required_xp)
  where greatest(coalesce(p_total_xp, 0), 0) >= required_xp;
$function$;

create or replace function public.arma_xp_uk_week_start(p_time timestamptz)
returns date
language sql
stable
as $function$
  select (
    (p_time at time zone 'Europe/London')::date
    - (extract(isodow from (p_time at time zone 'Europe/London'))::integer - 1)
  )::date;
$function$;

create or replace function public.arma_xp_uk_week_end(p_week_start date)
returns timestamptz
language sql
stable
as $function$
  select ((p_week_start + 7)::timestamp at time zone 'Europe/London');
$function$;

create or replace function public.cleanup_arma_xp_weekly_data()
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_current_week_start date;
begin
  v_current_week_start := public.arma_xp_uk_week_start(now());

  delete from public.arma_xp_event_receipts as receipt
  where receipt.week_start_date < v_current_week_start;

  delete from public.personnel_xp_weekly_stats as weekly
  where weekly.week_start_date < v_current_week_start;
end;
$function$;

create or replace function public.record_arma_xp_event(
  p_event_uid text,
  p_event_type text,
  p_steam_id text,
  p_xp_delta integer,
  p_server_id text,
  p_mission_id text,
  p_occurred_at timestamptz,
  p_target_category text default null
)
returns table (
  accepted boolean,
  duplicate boolean,
  personnel_id uuid,
  xp_delta integer,
  xp_total integer,
  current_level integer,
  week_xp integer,
  week_kill_count integer,
  week_death_count integer,
  week_teamkill_count integer,
  week_start_date date,
  week_end_at timestamptz,
  reason text
)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_personnel_id uuid;
  v_xp_before integer;
  v_xp_after integer;
  v_level_after integer;
  v_week_start_date date;
  v_week_end_at timestamptz;
  v_target_category text;
begin
  perform public.cleanup_arma_xp_weekly_data();

  if p_event_uid is null or length(btrim(p_event_uid)) = 0 then
    raise exception 'MISSING_EVENT_UID';
  end if;

  if p_event_type not in ('KILL', 'DEATH', 'OBJECTIVE', 'MISSION_COMPLETE') then
    raise exception 'INVALID_EVENT_TYPE';
  end if;

  v_week_start_date := public.arma_xp_uk_week_start(p_occurred_at);
  v_week_end_at := public.arma_xp_uk_week_end(v_week_start_date);
  v_target_category := upper(coalesce(nullif(btrim(p_target_category), ''), 'UNKNOWN'));

  select receipt.personnel_id,
         receipt.xp_delta
  into v_personnel_id,
       xp_delta
  from public.arma_xp_event_receipts as receipt
  where receipt.event_uid = p_event_uid;

  if found then
    select profile.total_xp,
           profile.current_level
    into xp_total,
         current_level
    from public.personnel_xp_profiles as profile
    where profile.personnel_id = v_personnel_id;

    select weekly.week_xp,
           weekly.week_kill_count,
           weekly.week_death_count,
           weekly.week_teamkill_count,
           weekly.week_start_date,
           weekly.week_end_at
    into week_xp,
         week_kill_count,
         week_death_count,
         week_teamkill_count,
         week_start_date,
         week_end_at
    from public.personnel_xp_weekly_stats as weekly
    where weekly.personnel_id = v_personnel_id;

    accepted := true;
    duplicate := true;
    personnel_id := v_personnel_id;
    reason := 'DUPLICATE_EVENT';
    return next;
    return;
  end if;

  select link.personnel_id
  into v_personnel_id
  from public.personnel_steam_links as link
  where link.steam_id = p_steam_id
    and link.revoked_at is null
  order by link.linked_at desc
  limit 1;

  if not found then
    accepted := false;
    duplicate := false;
    personnel_id := null;
    xp_delta := p_xp_delta;
    xp_total := null;
    current_level := null;
    week_xp := null;
    week_kill_count := null;
    week_death_count := null;
    week_teamkill_count := null;
    week_start_date := v_week_start_date;
    week_end_at := v_week_end_at;
    reason := 'STEAM_NOT_LINKED';
    return next;
    return;
  end if;

  insert into public.personnel_xp_profiles (personnel_id)
  values (v_personnel_id)
  on conflict (personnel_id) do nothing;

  select profile.total_xp
  into v_xp_before
  from public.personnel_xp_profiles as profile
  where profile.personnel_id = v_personnel_id
  for update;

  v_xp_after := greatest(0, v_xp_before + p_xp_delta);
  v_level_after := public.calculate_arma_xp_level(v_xp_after);

  update public.personnel_xp_profiles as profile
  set
    total_xp = v_xp_after,
    current_level = v_level_after,
    lifetime_kill_count = profile.lifetime_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 then 1 else 0 end,
    lifetime_death_count = profile.lifetime_death_count
      + case when p_event_type = 'DEATH' then 1 else 0 end,
    lifetime_teamkill_count = profile.lifetime_teamkill_count
      + case when p_event_type = 'KILL' and p_xp_delta < 0 then 1 else 0 end,
    last_event_at = greatest(coalesce(profile.last_event_at, p_occurred_at), p_occurred_at),
    updated_at = now()
  where profile.personnel_id = v_personnel_id;

  insert into public.personnel_xp_weekly_stats (
    personnel_id,
    week_start_date,
    week_end_at
  )
  values (
    v_personnel_id,
    v_week_start_date,
    v_week_end_at
  )
  on conflict (personnel_id) do update
  set
    week_start_date = excluded.week_start_date,
    week_end_at = excluded.week_end_at,
    week_xp = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_xp
      else 0
    end,
    week_positive_xp = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_positive_xp
      else 0
    end,
    week_negative_xp = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_negative_xp
      else 0
    end,
    week_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_kill_count
      else 0
    end,
    week_death_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_death_count
      else 0
    end,
    week_teamkill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.week_teamkill_count
      else 0
    end,
    infantry_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.infantry_kill_count
      else 0
    end,
    specialist_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.specialist_kill_count
      else 0
    end,
    static_weapon_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.static_weapon_kill_count
      else 0
    end,
    light_vehicle_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.light_vehicle_kill_count
      else 0
    end,
    vehicle_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.vehicle_kill_count
      else 0
    end,
    apc_ifv_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.apc_ifv_kill_count
      else 0
    end,
    tank_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.tank_kill_count
      else 0
    end,
    aircraft_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.aircraft_kill_count
      else 0
    end,
    unknown_kill_count = case
      when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date
        then public.personnel_xp_weekly_stats.unknown_kill_count
      else 0
    end,
    last_event_at = null,
    updated_at = now();

  update public.personnel_xp_weekly_stats as weekly
  set
    week_xp = greatest(0, weekly.week_xp + p_xp_delta),
    week_positive_xp = weekly.week_positive_xp
      + case when p_xp_delta > 0 then p_xp_delta else 0 end,
    week_negative_xp = weekly.week_negative_xp
      + case when p_xp_delta < 0 then p_xp_delta else 0 end,
    week_kill_count = weekly.week_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 then 1 else 0 end,
    week_death_count = weekly.week_death_count
      + case when p_event_type = 'DEATH' then 1 else 0 end,
    week_teamkill_count = weekly.week_teamkill_count
      + case when p_event_type = 'KILL' and p_xp_delta < 0 then 1 else 0 end,
    infantry_kill_count = weekly.infantry_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'INFANTRY' then 1 else 0 end,
    specialist_kill_count = weekly.specialist_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category in ('SPECIALIST_INFANTRY', 'CREW_OR_PILOT') then 1 else 0 end,
    static_weapon_kill_count = weekly.static_weapon_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'STATIC_WEAPON' then 1 else 0 end,
    light_vehicle_kill_count = weekly.light_vehicle_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'LIGHT_VEHICLE' then 1 else 0 end,
    vehicle_kill_count = weekly.vehicle_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'VEHICLE' then 1 else 0 end,
    apc_ifv_kill_count = weekly.apc_ifv_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'APC_IFV' then 1 else 0 end,
    tank_kill_count = weekly.tank_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'TANK' then 1 else 0 end,
    aircraft_kill_count = weekly.aircraft_kill_count
      + case when p_event_type = 'KILL' and p_xp_delta >= 0 and v_target_category = 'AIRCRAFT' then 1 else 0 end,
    unknown_kill_count = weekly.unknown_kill_count
      + case
          when p_event_type = 'KILL'
            and p_xp_delta >= 0
            and v_target_category not in (
              'INFANTRY',
              'SPECIALIST_INFANTRY',
              'CREW_OR_PILOT',
              'STATIC_WEAPON',
              'LIGHT_VEHICLE',
              'VEHICLE',
              'APC_IFV',
              'TANK',
              'AIRCRAFT'
            )
          then 1
          else 0
        end,
    last_event_at = greatest(coalesce(weekly.last_event_at, p_occurred_at), p_occurred_at),
    updated_at = now()
  where weekly.personnel_id = v_personnel_id;

  insert into public.arma_xp_event_receipts (
    event_uid,
    personnel_id,
    steam_id,
    event_type,
    xp_delta,
    server_id,
    mission_id,
    week_start_date,
    occurred_at
  )
  values (
    p_event_uid,
    v_personnel_id,
    p_steam_id,
    p_event_type,
    p_xp_delta,
    p_server_id,
    p_mission_id,
    v_week_start_date,
    p_occurred_at
  );

  select weekly.week_xp,
         weekly.week_kill_count,
         weekly.week_death_count,
         weekly.week_teamkill_count
  into week_xp,
       week_kill_count,
       week_death_count,
       week_teamkill_count
  from public.personnel_xp_weekly_stats as weekly
  where weekly.personnel_id = v_personnel_id;

  accepted := true;
  duplicate := false;
  personnel_id := v_personnel_id;
  xp_delta := p_xp_delta;
  xp_total := v_xp_after;
  current_level := v_level_after;
  week_start_date := v_week_start_date;
  week_end_at := v_week_end_at;
  reason := 'RECORDED';
  return next;
end;
$function$;

revoke all on function public.calculate_arma_xp_level(integer) from public;
revoke all on function public.calculate_arma_xp_level(integer) from anon;
revoke all on function public.calculate_arma_xp_level(integer) from authenticated;
grant execute on function public.calculate_arma_xp_level(integer) to service_role;

revoke all on function public.arma_xp_uk_week_start(timestamptz) from public;
revoke all on function public.arma_xp_uk_week_start(timestamptz) from anon;
revoke all on function public.arma_xp_uk_week_start(timestamptz) from authenticated;
grant execute on function public.arma_xp_uk_week_start(timestamptz) to service_role;

revoke all on function public.arma_xp_uk_week_end(date) from public;
revoke all on function public.arma_xp_uk_week_end(date) from anon;
revoke all on function public.arma_xp_uk_week_end(date) from authenticated;
grant execute on function public.arma_xp_uk_week_end(date) to service_role;

revoke all on function public.cleanup_arma_xp_weekly_data() from public;
revoke all on function public.cleanup_arma_xp_weekly_data() from anon;
revoke all on function public.cleanup_arma_xp_weekly_data() from authenticated;
grant execute on function public.cleanup_arma_xp_weekly_data() to service_role;

revoke all on function public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text
) from public;
revoke all on function public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text
) from anon;
revoke all on function public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text
) from authenticated;
grant execute on function public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text
) to service_role;
