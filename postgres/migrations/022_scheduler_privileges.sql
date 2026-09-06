do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'roster_app_scheduler') then
    create role roster_app_scheduler nologin nosuperuser nocreatedb nocreaterole
      noinherit noreplication nobypassrls connection limit 2;
  end if;
end;
$$;

do $$
begin
  execute format('grant connect on database %I to roster_app_scheduler', current_database());
end;
$$;

grant usage on schema public to roster_app_scheduler;

alter function public.reset_arma_xp_weekly_data() security definer;
alter function public.reset_arma_xp_weekly_data() set search_path = public, pg_temp;
alter function public.ensure_current_attendance_week() security definer;
alter function public.ensure_current_attendance_week() set search_path = public, pg_temp;
alter function public.reset_server_bookings_weekly() security definer;
alter function public.reset_server_bookings_weekly() set search_path = public, pg_temp;
alter function public.shift_recurring_server_blocks_week() security definer;
alter function public.shift_recurring_server_blocks_week() set search_path = public, pg_temp;

revoke all on function public.reset_arma_xp_weekly_data() from public;
revoke all on function public.ensure_current_attendance_week() from public;
revoke all on function public.reset_server_bookings_weekly() from public;
revoke all on function public.shift_recurring_server_blocks_week() from public;

grant execute on function public.reset_arma_xp_weekly_data() to roster_app_scheduler;
grant execute on function public.ensure_current_attendance_week() to roster_app_scheduler;
grant execute on function public.reset_server_bookings_weekly() to roster_app_scheduler;
grant execute on function public.shift_recurring_server_blocks_week() to roster_app_scheduler;

-- The protected website cron endpoint also uses the runtime role for this function.
grant execute on function public.reset_arma_xp_weekly_data() to roster_app_runtime;
