grant select, insert, update, delete on
  public.platoons, public.hq_assets, public.token_transactions, public.platoon_assets,
  public.cis_commander, public.cis_assets, public.cis_commander_assets, public.cis_transactions
to roster_app_runtime;

do $policies$
declare table_name text;
begin
  foreach table_name in array array['platoons','hq_assets','token_transactions','platoon_assets','cis_commander','cis_assets','cis_commander_assets','cis_transactions'] loop
    execute format('drop policy if exists %I on public.%I', 'native runtime ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)', 'native runtime ' || table_name, table_name);
  end loop;
end $policies$;

create unique index if not exists cis_commander_assets_asset_id_key on public.cis_commander_assets(asset_id);

grant execute on function public.check_shop_password(text) to roster_app_runtime;
