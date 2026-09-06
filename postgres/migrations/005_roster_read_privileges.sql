grant select on
  public.ranks,
  public.rank_history
to roster_app_runtime;

drop policy if exists "native runtime ranks" on public.ranks;
create policy "native runtime ranks"
  on public.ranks for select to roster_app_runtime using (true);

drop policy if exists "native runtime rank history" on public.rank_history;
create policy "native runtime rank history"
  on public.rank_history for select to roster_app_runtime using (true);
