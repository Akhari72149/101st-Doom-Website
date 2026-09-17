drop policy if exists "native runtime rank history updates" on public.rank_history;
create policy "native runtime rank history updates"
  on public.rank_history for update to roster_app_runtime
  using (true)
  with check (true);
