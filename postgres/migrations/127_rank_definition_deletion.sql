grant delete on public.ranks to roster_app_runtime;

drop policy if exists "native runtime rank delete" on public.ranks;
create policy "native runtime rank delete"
  on public.ranks for delete to roster_app_runtime
  using (true);
