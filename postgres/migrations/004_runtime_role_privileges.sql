do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'roster_app_runtime') then
    raise exception 'Create roster_app_runtime before applying this migration';
  end if;
end;
$$;

do $$
begin
  execute format('grant connect on database %I to roster_app_runtime', current_database());
end;
$$;
grant usage on schema public to roster_app_runtime;

grant select, insert, update, delete on
  public.app_auth_users,
  public.app_auth_accounts,
  public.app_auth_sessions,
  public.app_auth_verifications,
  public.app_auth_rate_limits
to roster_app_runtime;

grant select on
  public.app_page_permissions,
  public.profiles,
  public.personnel,
  public.personnel_certifications,
  public.recurring_server_blocks
to roster_app_runtime;

grant select, insert, update, delete on
  public.user_page_permissions,
  public.user_roles,
  public.server_bookings
to roster_app_runtime;

grant select, update on public.discord_role_outbox to roster_app_runtime;

drop policy if exists "native runtime page definitions" on public.app_page_permissions;
create policy "native runtime page definitions"
  on public.app_page_permissions for select to roster_app_runtime using (true);

drop policy if exists "native runtime page assignments" on public.user_page_permissions;
create policy "native runtime page assignments"
  on public.user_page_permissions for all to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime roles" on public.user_roles;
create policy "native runtime roles"
  on public.user_roles for all to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime profiles" on public.profiles;
create policy "native runtime profiles"
  on public.profiles for select to roster_app_runtime using (true);

drop policy if exists "native runtime personnel" on public.personnel;
create policy "native runtime personnel"
  on public.personnel for select to roster_app_runtime using (true);

drop policy if exists "native runtime personnel certifications" on public.personnel_certifications;
create policy "native runtime personnel certifications"
  on public.personnel_certifications for select to roster_app_runtime using (true);

drop policy if exists "native runtime server bookings" on public.server_bookings;
create policy "native runtime server bookings"
  on public.server_bookings for all to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime recurring blocks" on public.recurring_server_blocks;
create policy "native runtime recurring blocks"
  on public.recurring_server_blocks for select to roster_app_runtime using (true);

drop policy if exists "native runtime discord outbox" on public.discord_role_outbox;
create policy "native runtime discord outbox"
  on public.discord_role_outbox for select to roster_app_runtime using (true);
drop policy if exists "native runtime discord outbox updates" on public.discord_role_outbox;
create policy "native runtime discord outbox updates"
  on public.discord_role_outbox for update to roster_app_runtime using (true) with check (true);

do $$
declare
  function_name regprocedure;
begin
  for function_name in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'record_arma_xp_event',
        'record_arma_medical_event',
        'reset_arma_xp_weekly_data'
      )
  loop
    execute format('revoke all on function %s from public', function_name);
    execute format('grant execute on function %s to roster_app_runtime', function_name);
  end loop;
end;
$$;
