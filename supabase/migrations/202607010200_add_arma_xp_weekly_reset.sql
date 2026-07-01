create or replace function public.reset_arma_xp_weekly_data()
returns table (
  receipts_deleted integer,
  weekly_stats_deleted integer,
  target_stats_deleted integer
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

  return next;
end;
$function$;

revoke all on function public.reset_arma_xp_weekly_data() from public;
revoke all on function public.reset_arma_xp_weekly_data() from anon;
revoke all on function public.reset_arma_xp_weekly_data() from authenticated;
grant execute on function public.reset_arma_xp_weekly_data() to service_role;
