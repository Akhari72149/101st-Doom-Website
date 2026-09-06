grant insert, delete on public.personnel_awards to roster_app_runtime;
drop policy if exists "native runtime personnel award inserts" on public.personnel_awards;
create policy "native runtime personnel award inserts" on public.personnel_awards
  for insert to roster_app_runtime with check (true);
drop policy if exists "native runtime personnel award deletes" on public.personnel_awards;
create policy "native runtime personnel award deletes" on public.personnel_awards
  for delete to roster_app_runtime using (true);

