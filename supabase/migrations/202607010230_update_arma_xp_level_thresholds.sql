create or replace function public.calculate_arma_xp_level(p_total_xp integer)
returns integer
language sql
immutable
as $function$
  select coalesce(max(level_value), 1)
  from (
    values
      (1, 0),
      (2, 500),
      (3, 1000),
      (4, 1500),
      (5, 2000),
      (6, 2500),
      (7, 3500),
      (8, 5000),
      (9, 7000),
      (10, 9000),
      (11, 11500),
      (12, 14500),
      (13, 18000),
      (14, 22000),
      (15, 26500),
      (16, 31500),
      (17, 37000),
      (18, 43000),
      (19, 49500),
      (20, 56500),
      (21, 64000),
      (22, 72000),
      (23, 80500),
      (24, 89500),
      (25, 99000)
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
