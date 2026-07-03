alter table public.personnel_xp_profiles
  add column if not exists lifetime_vehicle_kill_count integer not null default 0 check (lifetime_vehicle_kill_count >= 0),
  add column if not exists lifetime_aircraft_kill_count integer not null default 0 check (lifetime_aircraft_kill_count >= 0);

insert into public.awards (
  code,
  name,
  description,
  category,
  icon_key,
  ribbon_color,
  award_type,
  trigger_domain,
  trigger_metric,
  trigger_threshold,
  sort_order,
  is_active
)
values (
  'THE_CREATOR',
  'The Creator',
  'A hidden decoration reserved for the person who built and maintains the systems, records, and machinery behind the battalion.',
  'Hidden',
  'star',
  '#f5f5f4',
  'manual',
  null,
  null,
  null,
  1,
  false
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon_key = excluded.icon_key,
  ribbon_color = excluded.ribbon_color,
  award_type = excluded.award_type,
  trigger_domain = excluded.trigger_domain,
  trigger_metric = excluded.trigger_metric,
  trigger_threshold = excluded.trigger_threshold,
  sort_order = excluded.sort_order,
  is_active = false,
  updated_at = now();

create or replace function public.award_eligible_automatic_medals(
  p_personnel_id uuid
)
returns integer
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_inserted integer := 0;
begin
  if p_personnel_id is null then
    return 0;
  end if;

  with metric_values as (
    select
      coalesce(xp.lifetime_kill_count, 0)::numeric as lifetime_kills,
      coalesce(xp.lifetime_vehicle_kill_count, 0)::numeric as vehicle_kills,
      coalesce(xp.lifetime_aircraft_kill_count, 0)::numeric as aircraft_kills,
      coalesce(med.lifetime_heart_restart_count, 0)::numeric as heart_restarts,
      coalesce(med.lifetime_plasma_litres, 0)::numeric as plasma_litres,
      coalesce(med.lifetime_surgery_count, 0)::numeric as surgeries,
      (
        coalesce(med.lifetime_airway_check_count, 0)
        + coalesce(med.lifetime_lung_treatment_count, 0)
      )::numeric as airway_lung_actions
    from (select p_personnel_id as personnel_id) as base
    left join public.personnel_xp_profiles as xp
      on xp.personnel_id = base.personnel_id
    left join public.personnel_medical_profiles as med
      on med.personnel_id = base.personnel_id
  ),
  eligible_awards as (
    select
      award.id,
      award.code,
      award.trigger_metric,
      award.trigger_threshold
    from public.awards as award
    cross join metric_values as metric
    where award.award_type = 'automatic'
      and award.is_active = true
      and award.trigger_threshold is not null
      and case award.trigger_metric
        when 'lifetime_kills' then metric.lifetime_kills
        when 'vehicle_kills' then metric.vehicle_kills
        when 'aircraft_kills' then metric.aircraft_kills
        when 'heart_restarts' then metric.heart_restarts
        when 'plasma_litres' then metric.plasma_litres
        when 'surgeries' then metric.surgeries
        when 'airway_lung_actions' then metric.airway_lung_actions
        else 0
      end >= award.trigger_threshold
  ),
  inserted as (
    insert into public.personnel_awards (
      personnel_id,
      award_id,
      awarded_at,
      notes,
      source,
      source_event_id
    )
    select
      p_personnel_id,
      eligible.id,
      now(),
      'Automatically awarded after reaching '
        || eligible.trigger_threshold::text
        || ' '
        || replace(eligible.trigger_metric, '_', ' ')
        || '.',
      'automatic',
      'automatic-medal:' || eligible.code
    from eligible_awards as eligible
    on conflict (personnel_id, award_id) do nothing
    returning 1
  )
  select count(*)::integer
  into v_inserted
  from inserted;

  return coalesce(v_inserted, 0);
end;
$function$;

create or replace function public.award_eligible_automatic_medals_from_profile()
returns trigger
language plpgsql
security definer
set search_path to public
as $function$
begin
  perform public.award_eligible_automatic_medals(new.personnel_id);
  return new;
end;
$function$;

create or replace function public.capture_arma_lifetime_category_kills()
returns trigger
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_vehicle_delta integer;
  v_aircraft_delta integer;
begin
  v_vehicle_delta :=
    greatest(0, coalesce(new.light_vehicle_kill_count, 0) - coalesce(old.light_vehicle_kill_count, 0))
    + greatest(0, coalesce(new.vehicle_kill_count, 0) - coalesce(old.vehicle_kill_count, 0))
    + greatest(0, coalesce(new.apc_ifv_kill_count, 0) - coalesce(old.apc_ifv_kill_count, 0))
    + greatest(0, coalesce(new.tank_kill_count, 0) - coalesce(old.tank_kill_count, 0));

  v_aircraft_delta :=
    greatest(0, coalesce(new.aircraft_kill_count, 0) - coalesce(old.aircraft_kill_count, 0));

  if v_vehicle_delta > 0 or v_aircraft_delta > 0 then
    insert into public.personnel_xp_profiles (personnel_id)
    values (new.personnel_id)
    on conflict (personnel_id) do nothing;

    update public.personnel_xp_profiles as profile
    set
      lifetime_vehicle_kill_count = profile.lifetime_vehicle_kill_count + v_vehicle_delta,
      lifetime_aircraft_kill_count = profile.lifetime_aircraft_kill_count + v_aircraft_delta,
      updated_at = now()
    where profile.personnel_id = new.personnel_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists award_automatic_medals_after_xp_profile_change on public.personnel_xp_profiles;
create trigger award_automatic_medals_after_xp_profile_change
after insert or update of
  lifetime_kill_count,
  lifetime_vehicle_kill_count,
  lifetime_aircraft_kill_count
on public.personnel_xp_profiles
for each row
execute function public.award_eligible_automatic_medals_from_profile();

drop trigger if exists award_automatic_medals_after_medical_profile_change on public.personnel_medical_profiles;
create trigger award_automatic_medals_after_medical_profile_change
after insert or update of
  lifetime_plasma_litres,
  lifetime_surgery_count,
  lifetime_heart_restart_count,
  lifetime_lung_treatment_count,
  lifetime_airway_check_count
on public.personnel_medical_profiles
for each row
execute function public.award_eligible_automatic_medals_from_profile();

drop trigger if exists capture_lifetime_category_kills_after_weekly_change on public.personnel_xp_weekly_stats;
create trigger capture_lifetime_category_kills_after_weekly_change
after update of
  light_vehicle_kill_count,
  vehicle_kill_count,
  apc_ifv_kill_count,
  tank_kill_count,
  aircraft_kill_count
on public.personnel_xp_weekly_stats
for each row
execute function public.capture_arma_lifetime_category_kills();

revoke all on function public.award_eligible_automatic_medals(uuid) from public;
revoke all on function public.award_eligible_automatic_medals(uuid) from anon;
revoke all on function public.award_eligible_automatic_medals(uuid) from authenticated;
grant execute on function public.award_eligible_automatic_medals(uuid) to service_role;

revoke all on function public.award_eligible_automatic_medals_from_profile() from public;
revoke all on function public.award_eligible_automatic_medals_from_profile() from anon;
revoke all on function public.award_eligible_automatic_medals_from_profile() from authenticated;
grant execute on function public.award_eligible_automatic_medals_from_profile() to service_role;

revoke all on function public.capture_arma_lifetime_category_kills() from public;
revoke all on function public.capture_arma_lifetime_category_kills() from anon;
revoke all on function public.capture_arma_lifetime_category_kills() from authenticated;
grant execute on function public.capture_arma_lifetime_category_kills() to service_role;

do $$
declare
  v_personnel_id uuid;
begin
  for v_personnel_id in
    select profile.personnel_id
    from public.personnel_xp_profiles as profile
    union
    select profile.personnel_id
    from public.personnel_medical_profiles as profile
  loop
    perform public.award_eligible_automatic_medals(v_personnel_id);
  end loop;
end
$$;
