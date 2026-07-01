create table if not exists public.personnel_xp_weekly_target_stats (
  personnel_id uuid not null
    references public.personnel(id)
    on delete cascade,

  week_start_date date not null,
  week_end_at timestamptz not null,

  target_category text not null,
  target_class text not null,
  target_display_name text not null,

  kill_count integer not null default 0
    constraint personnel_xp_weekly_target_stats_kill_count_check
    check (kill_count >= 0),

  xp_total integer not null default 0
    constraint personnel_xp_weekly_target_stats_xp_total_check
    check (xp_total >= 0),

  last_killed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (personnel_id, week_start_date, target_class)
);

create index if not exists personnel_xp_weekly_target_stats_week_idx
  on public.personnel_xp_weekly_target_stats (week_start_date, kill_count desc);

alter table public.personnel_xp_weekly_target_stats enable row level security;

revoke all on public.personnel_xp_weekly_target_stats from anon;
revoke all on public.personnel_xp_weekly_target_stats from authenticated;
grant all on public.personnel_xp_weekly_target_stats to service_role;

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

  delete from public.personnel_xp_weekly_target_stats as target
  where target.week_start_date < v_current_week_start;
end;
$function$;

drop function if exists public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text
);

create or replace function public.record_arma_xp_event(
  p_event_uid text,
  p_event_type text,
  p_steam_id text,
  p_xp_delta integer,
  p_server_id text,
  p_mission_id text,
  p_occurred_at timestamptz,
  p_target_category text default null,
  p_target_class text default null,
  p_target_display_name text default null
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
  target_week_kill_count integer,
  target_week_xp integer,
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
  v_target_class text;
  v_target_display_name text;
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
  v_target_class := coalesce(nullif(btrim(p_target_class), ''), 'UNKNOWN');
  v_target_display_name := coalesce(nullif(btrim(p_target_display_name), ''), v_target_class);

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

    select target.kill_count,
           target.xp_total
    into target_week_kill_count,
         target_week_xp
    from public.personnel_xp_weekly_target_stats as target
    where target.personnel_id = v_personnel_id
      and target.week_start_date = week_start_date
      and target.target_class = v_target_class;

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
    target_week_kill_count := null;
    target_week_xp := null;
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

  if p_event_type = 'KILL' and p_xp_delta >= 0 then
    insert into public.personnel_xp_weekly_target_stats (
      personnel_id,
      week_start_date,
      week_end_at,
      target_category,
      target_class,
      target_display_name,
      kill_count,
      xp_total,
      last_killed_at
    )
    values (
      v_personnel_id,
      v_week_start_date,
      v_week_end_at,
      v_target_category,
      v_target_class,
      v_target_display_name,
      1,
      greatest(0, p_xp_delta),
      p_occurred_at
    )
    on conflict (personnel_id, week_start_date, target_class) do update
    set
      target_category = excluded.target_category,
      target_display_name = excluded.target_display_name,
      kill_count = public.personnel_xp_weekly_target_stats.kill_count + 1,
      xp_total = public.personnel_xp_weekly_target_stats.xp_total + greatest(0, p_xp_delta),
      last_killed_at = greatest(
        coalesce(public.personnel_xp_weekly_target_stats.last_killed_at, excluded.last_killed_at),
        excluded.last_killed_at
      ),
      updated_at = now();
  end if;

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

  select target.kill_count,
         target.xp_total
  into target_week_kill_count,
       target_week_xp
  from public.personnel_xp_weekly_target_stats as target
  where target.personnel_id = v_personnel_id
    and target.week_start_date = v_week_start_date
    and target.target_class = v_target_class;

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

revoke all on function public.record_arma_xp_event(
  text,
  text,
  text,
  integer,
  text,
  text,
  timestamptz,
  text,
  text,
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
  text,
  text,
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
  text,
  text,
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
  text,
  text,
  text
) to service_role;
