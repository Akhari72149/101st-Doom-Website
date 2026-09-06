grant select, insert, update on
  public.arma_campaign_status_current,
  public.arma_campaign_status_history
to roster_app_runtime;

grant select on
  public.arma_campaign_story_episodes,
  public.arma_campaign_story_objectives
to roster_app_runtime;

do $policies$
declare table_name text;
begin
  foreach table_name in array array['arma_campaign_status_current','arma_campaign_status_history'] loop
    execute format('drop policy if exists %I on public.%I', 'native runtime ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)', 'native runtime ' || table_name, table_name);
  end loop;
  foreach table_name in array array['arma_campaign_story_episodes','arma_campaign_story_objectives'] loop
    execute format('drop policy if exists %I on public.%I', 'native runtime ' || table_name, table_name);
    execute format('create policy %I on public.%I for select to roster_app_runtime using (true)', 'native runtime ' || table_name, table_name);
  end loop;
end $policies$;

