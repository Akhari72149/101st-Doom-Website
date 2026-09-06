grant select, insert, update, delete on public.operation_plans to roster_app_runtime;
drop policy if exists "native runtime operation plans" on public.operation_plans;
create policy "native runtime operation plans" on public.operation_plans for all to roster_app_runtime using (true) with check (true);
