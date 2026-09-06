grant select on public.org_nodes to roster_app_runtime;

drop policy if exists "native runtime org nodes" on public.org_nodes;
create policy "native runtime org nodes"
  on public.org_nodes for select to roster_app_runtime using (true);
