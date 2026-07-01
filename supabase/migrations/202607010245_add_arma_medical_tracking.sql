create table if not exists public.personnel_medical_profiles (
  personnel_id uuid primary key references public.personnel(id) on delete cascade,
  lifetime_blood_litres numeric(10,2) not null default 0 check (lifetime_blood_litres >= 0),
  lifetime_plasma_litres numeric(10,2) not null default 0 check (lifetime_plasma_litres >= 0),
  lifetime_saline_litres numeric(10,2) not null default 0 check (lifetime_saline_litres >= 0),
  lifetime_bandage_count integer not null default 0 check (lifetime_bandage_count >= 0),
  lifetime_stitched_body_part_count integer not null default 0 check (lifetime_stitched_body_part_count >= 0),
  lifetime_surgery_count integer not null default 0 check (lifetime_surgery_count >= 0),
  lifetime_heart_restart_count integer not null default 0 check (lifetime_heart_restart_count >= 0),
  lifetime_lung_treatment_count integer not null default 0 check (lifetime_lung_treatment_count >= 0),
  lifetime_airway_check_count integer not null default 0 check (lifetime_airway_check_count >= 0),
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personnel_medical_weekly_stats (
  personnel_id uuid primary key references public.personnel(id) on delete cascade,
  week_start_date date not null,
  week_end_at timestamptz not null,
  week_blood_litres numeric(10,2) not null default 0 check (week_blood_litres >= 0),
  week_plasma_litres numeric(10,2) not null default 0 check (week_plasma_litres >= 0),
  week_saline_litres numeric(10,2) not null default 0 check (week_saline_litres >= 0),
  week_bandage_count integer not null default 0 check (week_bandage_count >= 0),
  week_stitched_body_part_count integer not null default 0 check (week_stitched_body_part_count >= 0),
  week_surgery_count integer not null default 0 check (week_surgery_count >= 0),
  week_heart_restart_count integer not null default 0 check (week_heart_restart_count >= 0),
  week_lung_treatment_count integer not null default 0 check (week_lung_treatment_count >= 0),
  week_airway_check_count integer not null default 0 check (week_airway_check_count >= 0),
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arma_medical_event_receipts (
  event_uid text primary key,
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  steam_id text not null,
  medical_metric text not null,
  medical_quantity numeric(10,2) not null default 0,
  xp_delta integer not null default 0,
  server_id text not null,
  mission_id text not null,
  week_start_date date not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists personnel_medical_profiles_last_event_idx
  on public.personnel_medical_profiles (last_event_at desc);

create index if not exists personnel_medical_weekly_stats_week_idx
  on public.personnel_medical_weekly_stats (week_start_date, last_event_at desc);

create index if not exists arma_medical_event_receipts_personnel_week_idx
  on public.arma_medical_event_receipts (personnel_id, week_start_date);

alter table public.personnel_medical_profiles enable row level security;
alter table public.personnel_medical_weekly_stats enable row level security;
alter table public.arma_medical_event_receipts enable row level security;

revoke all on public.personnel_medical_profiles from anon;
revoke all on public.personnel_medical_profiles from authenticated;
grant all on public.personnel_medical_profiles to service_role;

revoke all on public.personnel_medical_weekly_stats from anon;
revoke all on public.personnel_medical_weekly_stats from authenticated;
grant all on public.personnel_medical_weekly_stats to service_role;

revoke all on public.arma_medical_event_receipts from anon;
revoke all on public.arma_medical_event_receipts from authenticated;
grant all on public.arma_medical_event_receipts to service_role;

create or replace function public.calculate_arma_medical_xp(
  p_medical_metric text,
  p_medical_quantity numeric
)
returns integer
language sql
immutable
as $function$
  select least(
    30,
    greatest(
      0,
      case upper(coalesce(p_medical_metric, ''))
        when 'PLASMA_LITRES' then ceil(greatest(coalesce(p_medical_quantity, 0), 0) * 10)::integer
        when 'SALINE_LITRES' then ceil(greatest(coalesce(p_medical_quantity, 0), 0) * 6)::integer
        when 'BLOOD_LITRES' then ceil(greatest(coalesce(p_medical_quantity, 0), 0) * 10)::integer
        when 'BANDAGE_APPLIED' then 3
        when 'AIRWAY_CHECKED' then 5
        when 'LUNG_TREATED' then 15
        when 'SURGERY_COMPLETE' then 25
        when 'HEART_RESTARTED' then 25
        when 'STITCHED_BODY_PART' then 30
        else 0
      end
    )
  );
$function$;

create or replace function public.record_arma_medical_event(
  p_event_uid text,
  p_steam_id text,
  p_medical_metric text,
  p_medical_quantity numeric,
  p_server_id text,
  p_mission_id text,
  p_occurred_at timestamptz,
  p_medical_action text default null,
  p_item_class text default null,
  p_treatment_class text default null,
  p_body_part text default null,
  p_patient_steam_id text default null
)
returns table (
  accepted boolean,
  duplicate boolean,
  personnel_id uuid,
  medical_metric text,
  medical_quantity numeric,
  xp_delta integer,
  xp_total integer,
  current_level integer,
  week_xp integer,
  lifetime_blood_litres numeric,
  lifetime_plasma_litres numeric,
  lifetime_saline_litres numeric,
  lifetime_bandage_count integer,
  lifetime_stitched_body_part_count integer,
  lifetime_surgery_count integer,
  lifetime_heart_restart_count integer,
  lifetime_lung_treatment_count integer,
  lifetime_airway_check_count integer,
  week_blood_litres numeric,
  week_plasma_litres numeric,
  week_saline_litres numeric,
  week_bandage_count integer,
  week_stitched_body_part_count integer,
  week_surgery_count integer,
  week_heart_restart_count integer,
  week_lung_treatment_count integer,
  week_airway_check_count integer,
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
  v_week_start_date date;
  v_week_end_at timestamptz;
  v_metric text;
  v_quantity numeric(10,2);
  v_xp_delta integer;
  v_xp_before integer;
  v_xp_after integer;
  v_level_after integer;
begin
  perform public.cleanup_arma_xp_weekly_data();

  v_metric := upper(coalesce(p_medical_metric, ''));
  v_quantity := greatest(coalesce(p_medical_quantity, 0), 0);
  v_xp_delta := public.calculate_arma_medical_xp(v_metric, v_quantity);
  v_week_start_date := public.arma_xp_uk_week_start(p_occurred_at);
  v_week_end_at := public.arma_xp_uk_week_end(v_week_start_date);

  if v_metric not in (
    'BLOOD_LITRES',
    'PLASMA_LITRES',
    'SALINE_LITRES',
    'BANDAGE_APPLIED',
    'STITCHED_BODY_PART',
    'SURGERY_COMPLETE',
    'HEART_RESTARTED',
    'LUNG_TREATED',
    'AIRWAY_CHECKED'
  ) then
    accepted := false;
    duplicate := false;
    medical_metric := v_metric;
    medical_quantity := v_quantity;
    week_start_date := v_week_start_date;
    week_end_at := v_week_end_at;
    reason := 'INVALID_MEDICAL_METRIC';
    return next;
    return;
  end if;

  select receipt.personnel_id,
         receipt.medical_metric,
         receipt.medical_quantity,
         receipt.xp_delta
  into v_personnel_id,
       medical_metric,
       medical_quantity,
       xp_delta
  from public.arma_medical_event_receipts as receipt
  where receipt.event_uid = p_event_uid;

  if found then
    select profile.total_xp,
           profile.current_level
    into xp_total,
         current_level
    from public.personnel_xp_profiles as profile
    where profile.personnel_id = v_personnel_id;

    select weekly.week_xp
    into week_xp
    from public.personnel_xp_weekly_stats as weekly
    where weekly.personnel_id = v_personnel_id;

    select
      profile.lifetime_blood_litres,
      profile.lifetime_plasma_litres,
      profile.lifetime_saline_litres,
      profile.lifetime_bandage_count,
      profile.lifetime_stitched_body_part_count,
      profile.lifetime_surgery_count,
      profile.lifetime_heart_restart_count,
      profile.lifetime_lung_treatment_count,
      profile.lifetime_airway_check_count
    into
      lifetime_blood_litres,
      lifetime_plasma_litres,
      lifetime_saline_litres,
      lifetime_bandage_count,
      lifetime_stitched_body_part_count,
      lifetime_surgery_count,
      lifetime_heart_restart_count,
      lifetime_lung_treatment_count,
      lifetime_airway_check_count
    from public.personnel_medical_profiles as profile
    where profile.personnel_id = v_personnel_id;

    select
      weekly.week_blood_litres,
      weekly.week_plasma_litres,
      weekly.week_saline_litres,
      weekly.week_bandage_count,
      weekly.week_stitched_body_part_count,
      weekly.week_surgery_count,
      weekly.week_heart_restart_count,
      weekly.week_lung_treatment_count,
      weekly.week_airway_check_count,
      weekly.week_start_date,
      weekly.week_end_at
    into
      week_blood_litres,
      week_plasma_litres,
      week_saline_litres,
      week_bandage_count,
      week_stitched_body_part_count,
      week_surgery_count,
      week_heart_restart_count,
      week_lung_treatment_count,
      week_airway_check_count,
      week_start_date,
      week_end_at
    from public.personnel_medical_weekly_stats as weekly
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
    medical_metric := v_metric;
    medical_quantity := v_quantity;
    week_start_date := v_week_start_date;
    week_end_at := v_week_end_at;
    reason := 'STEAM_NOT_LINKED';
    return next;
    return;
  end if;

  insert into public.personnel_medical_profiles (personnel_id)
  values (v_personnel_id)
  on conflict on constraint personnel_medical_profiles_pkey do nothing;

  insert into public.personnel_xp_profiles (personnel_id)
  values (v_personnel_id)
  on conflict on constraint personnel_xp_profiles_pkey do nothing;

  select profile.total_xp
  into v_xp_before
  from public.personnel_xp_profiles as profile
  where profile.personnel_id = v_personnel_id
  for update;

  v_xp_after := greatest(0, v_xp_before + v_xp_delta);
  v_level_after := public.calculate_arma_xp_level(v_xp_after);

  update public.personnel_xp_profiles as profile
  set
    total_xp = v_xp_after,
    current_level = v_level_after,
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
  on conflict on constraint personnel_xp_weekly_stats_pkey do update
  set
    week_start_date = excluded.week_start_date,
    week_end_at = excluded.week_end_at,
    week_xp = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_xp else 0 end,
    week_positive_xp = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_positive_xp else 0 end,
    week_negative_xp = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_negative_xp else 0 end,
    week_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_kill_count else 0 end,
    week_death_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_death_count else 0 end,
    week_teamkill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.week_teamkill_count else 0 end,
    infantry_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.infantry_kill_count else 0 end,
    specialist_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.specialist_kill_count else 0 end,
    static_weapon_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.static_weapon_kill_count else 0 end,
    light_vehicle_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.light_vehicle_kill_count else 0 end,
    vehicle_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.vehicle_kill_count else 0 end,
    apc_ifv_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.apc_ifv_kill_count else 0 end,
    tank_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.tank_kill_count else 0 end,
    aircraft_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.aircraft_kill_count else 0 end,
    unknown_kill_count = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.unknown_kill_count else 0 end,
    last_event_at = case when public.personnel_xp_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_xp_weekly_stats.last_event_at else null end,
    updated_at = now();

  update public.personnel_xp_weekly_stats as weekly
  set
    week_xp = greatest(0, weekly.week_xp + v_xp_delta),
    week_positive_xp = weekly.week_positive_xp + v_xp_delta,
    last_event_at = greatest(coalesce(weekly.last_event_at, p_occurred_at), p_occurred_at),
    updated_at = now()
  where weekly.personnel_id = v_personnel_id;

  insert into public.personnel_medical_weekly_stats (
    personnel_id,
    week_start_date,
    week_end_at
  )
  values (
    v_personnel_id,
    v_week_start_date,
    v_week_end_at
  )
  on conflict on constraint personnel_medical_weekly_stats_pkey do update
  set
    week_start_date = excluded.week_start_date,
    week_end_at = excluded.week_end_at,
    week_blood_litres = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_blood_litres else 0 end,
    week_plasma_litres = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_plasma_litres else 0 end,
    week_saline_litres = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_saline_litres else 0 end,
    week_bandage_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_bandage_count else 0 end,
    week_stitched_body_part_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_stitched_body_part_count else 0 end,
    week_surgery_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_surgery_count else 0 end,
    week_heart_restart_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_heart_restart_count else 0 end,
    week_lung_treatment_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_lung_treatment_count else 0 end,
    week_airway_check_count = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.week_airway_check_count else 0 end,
    last_event_at = case when public.personnel_medical_weekly_stats.week_start_date = excluded.week_start_date then public.personnel_medical_weekly_stats.last_event_at else null end,
    updated_at = now();

  update public.personnel_medical_profiles as profile
  set
    lifetime_blood_litres = profile.lifetime_blood_litres + case when v_metric = 'BLOOD_LITRES' then v_quantity else 0 end,
    lifetime_plasma_litres = profile.lifetime_plasma_litres + case when v_metric = 'PLASMA_LITRES' then v_quantity else 0 end,
    lifetime_saline_litres = profile.lifetime_saline_litres + case when v_metric = 'SALINE_LITRES' then v_quantity else 0 end,
    lifetime_bandage_count = profile.lifetime_bandage_count + case when v_metric = 'BANDAGE_APPLIED' then v_quantity::integer else 0 end,
    lifetime_stitched_body_part_count = profile.lifetime_stitched_body_part_count + case when v_metric = 'STITCHED_BODY_PART' then v_quantity::integer else 0 end,
    lifetime_surgery_count = profile.lifetime_surgery_count + case when v_metric = 'SURGERY_COMPLETE' then v_quantity::integer else 0 end,
    lifetime_heart_restart_count = profile.lifetime_heart_restart_count + case when v_metric = 'HEART_RESTARTED' then v_quantity::integer else 0 end,
    lifetime_lung_treatment_count = profile.lifetime_lung_treatment_count + case when v_metric = 'LUNG_TREATED' then v_quantity::integer else 0 end,
    lifetime_airway_check_count = profile.lifetime_airway_check_count + case when v_metric = 'AIRWAY_CHECKED' then v_quantity::integer else 0 end,
    last_event_at = greatest(coalesce(profile.last_event_at, p_occurred_at), p_occurred_at),
    updated_at = now()
  where profile.personnel_id = v_personnel_id;

  update public.personnel_medical_weekly_stats as weekly
  set
    week_blood_litres = weekly.week_blood_litres + case when v_metric = 'BLOOD_LITRES' then v_quantity else 0 end,
    week_plasma_litres = weekly.week_plasma_litres + case when v_metric = 'PLASMA_LITRES' then v_quantity else 0 end,
    week_saline_litres = weekly.week_saline_litres + case when v_metric = 'SALINE_LITRES' then v_quantity else 0 end,
    week_bandage_count = weekly.week_bandage_count + case when v_metric = 'BANDAGE_APPLIED' then v_quantity::integer else 0 end,
    week_stitched_body_part_count = weekly.week_stitched_body_part_count + case when v_metric = 'STITCHED_BODY_PART' then v_quantity::integer else 0 end,
    week_surgery_count = weekly.week_surgery_count + case when v_metric = 'SURGERY_COMPLETE' then v_quantity::integer else 0 end,
    week_heart_restart_count = weekly.week_heart_restart_count + case when v_metric = 'HEART_RESTARTED' then v_quantity::integer else 0 end,
    week_lung_treatment_count = weekly.week_lung_treatment_count + case when v_metric = 'LUNG_TREATED' then v_quantity::integer else 0 end,
    week_airway_check_count = weekly.week_airway_check_count + case when v_metric = 'AIRWAY_CHECKED' then v_quantity::integer else 0 end,
    last_event_at = greatest(coalesce(weekly.last_event_at, p_occurred_at), p_occurred_at),
    updated_at = now()
  where weekly.personnel_id = v_personnel_id;

  insert into public.arma_medical_event_receipts (
    event_uid,
    personnel_id,
    steam_id,
    medical_metric,
    medical_quantity,
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
    v_metric,
    v_quantity,
    v_xp_delta,
    p_server_id,
    p_mission_id,
    v_week_start_date,
    p_occurred_at
  );

  select
    profile.lifetime_blood_litres,
    profile.lifetime_plasma_litres,
    profile.lifetime_saline_litres,
    profile.lifetime_bandage_count,
    profile.lifetime_stitched_body_part_count,
    profile.lifetime_surgery_count,
    profile.lifetime_heart_restart_count,
    profile.lifetime_lung_treatment_count,
    profile.lifetime_airway_check_count
  into
    lifetime_blood_litres,
    lifetime_plasma_litres,
    lifetime_saline_litres,
    lifetime_bandage_count,
    lifetime_stitched_body_part_count,
    lifetime_surgery_count,
    lifetime_heart_restart_count,
    lifetime_lung_treatment_count,
    lifetime_airway_check_count
  from public.personnel_medical_profiles as profile
  where profile.personnel_id = v_personnel_id;

  select
    weekly.week_blood_litres,
    weekly.week_plasma_litres,
    weekly.week_saline_litres,
    weekly.week_bandage_count,
    weekly.week_stitched_body_part_count,
    weekly.week_surgery_count,
    weekly.week_heart_restart_count,
    weekly.week_lung_treatment_count,
    weekly.week_airway_check_count,
    weekly.week_start_date,
    weekly.week_end_at
  into
    week_blood_litres,
    week_plasma_litres,
    week_saline_litres,
    week_bandage_count,
    week_stitched_body_part_count,
    week_surgery_count,
    week_heart_restart_count,
    week_lung_treatment_count,
    week_airway_check_count,
    week_start_date,
    week_end_at
  from public.personnel_medical_weekly_stats as weekly
  where weekly.personnel_id = v_personnel_id;

  accepted := true;
  duplicate := false;
  personnel_id := v_personnel_id;
  medical_metric := v_metric;
  medical_quantity := v_quantity;
  xp_delta := v_xp_delta;
  xp_total := v_xp_after;
  current_level := v_level_after;

  select weekly.week_xp
  into week_xp
  from public.personnel_xp_weekly_stats as weekly
  where weekly.personnel_id = v_personnel_id;

  reason := 'RECORDED';
  return next;
end;
$function$;

revoke all on function public.calculate_arma_medical_xp(text, numeric) from public;
revoke all on function public.calculate_arma_medical_xp(text, numeric) from anon;
revoke all on function public.calculate_arma_medical_xp(text, numeric) from authenticated;
grant execute on function public.calculate_arma_medical_xp(text, numeric) to service_role;

revoke all on function public.record_arma_medical_event(text, text, text, numeric, text, text, timestamptz, text, text, text, text, text) from public;
revoke all on function public.record_arma_medical_event(text, text, text, numeric, text, text, timestamptz, text, text, text, text, text) from anon;
revoke all on function public.record_arma_medical_event(text, text, text, numeric, text, text, timestamptz, text, text, text, text, text) from authenticated;
grant execute on function public.record_arma_medical_event(text, text, text, numeric, text, text, timestamptz, text, text, text, text, text) to service_role;

drop function if exists public.reset_arma_xp_weekly_data();

create or replace function public.reset_arma_xp_weekly_data()
returns table (
  receipts_deleted integer,
  weekly_stats_deleted integer,
  target_stats_deleted integer,
  medical_receipts_deleted integer,
  medical_weekly_stats_deleted integer
)
language plpgsql
security definer
set search_path to public
as $function$
begin
  delete from public.arma_xp_event_receipts;
  get diagnostics receipts_deleted = row_count;

  delete from public.personnel_xp_weekly_target_stats;
  get diagnostics target_stats_deleted = row_count;

  delete from public.personnel_xp_weekly_stats;
  get diagnostics weekly_stats_deleted = row_count;

  delete from public.arma_medical_event_receipts;
  get diagnostics medical_receipts_deleted = row_count;

  delete from public.personnel_medical_weekly_stats;
  get diagnostics medical_weekly_stats_deleted = row_count;

  return next;
end;
$function$;

revoke all on function public.reset_arma_xp_weekly_data() from public;
revoke all on function public.reset_arma_xp_weekly_data() from anon;
revoke all on function public.reset_arma_xp_weekly_data() from authenticated;
grant execute on function public.reset_arma_xp_weekly_data() to service_role;
