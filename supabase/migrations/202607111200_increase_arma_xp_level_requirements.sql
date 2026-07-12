create or replace function public.calculate_arma_xp_level(p_total_xp integer)
returns integer
language sql
immutable
as $function$
  select coalesce(max(level_value), 1)
  from (
    values
      (1, 0),
      (2, 2500),
      (3, 6000),
      (4, 11000),
      (5, 18000),
      (6, 28000),
      (7, 42000),
      (8, 60000),
      (9, 85000),
      (10, 115000),
      (11, 150000),
      (12, 190000),
      (13, 235000),
      (14, 285000),
      (15, 340000),
      (16, 400000),
      (17, 470000),
      (18, 550000),
      (19, 640000),
      (20, 740000),
      (21, 855000),
      (22, 985000),
      (23, 1130000),
      (24, 1290000),
      (25, 1475000)
  ) as thresholds(level_value, required_xp)
  where greatest(coalesce(p_total_xp, 0), 0) >= required_xp;
$function$;

update public.personnel_xp_profiles as profile
set
  current_level = public.calculate_arma_xp_level(profile.total_xp),
  updated_at = now()
where profile.current_level is distinct from public.calculate_arma_xp_level(profile.total_xp);

revoke all on function public.calculate_arma_xp_level(integer) from public;
revoke all on function public.calculate_arma_xp_level(integer) from anon;
revoke all on function public.calculate_arma_xp_level(integer) from authenticated;
grant execute on function public.calculate_arma_xp_level(integer) to service_role;
