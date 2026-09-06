grant select, insert, update, delete on
  public.steam_link_sessions,
  public.personnel_discord_verification_challenges,
  public.personnel_steam_links,
  public.personnel_steam_link_audit
to roster_app_runtime;

do $policies$
declare table_name text;
begin
  foreach table_name in array array[
    'steam_link_sessions',
    'personnel_discord_verification_challenges',
    'personnel_steam_links',
    'personnel_steam_link_audit'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'native runtime ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)', 'native runtime ' || table_name, table_name);
  end loop;
end $policies$;

revoke all on function public.finalize_steam_link_from_discord(uuid, uuid) from public;
grant execute on function public.finalize_steam_link_from_discord(uuid, uuid) to roster_app_runtime;

