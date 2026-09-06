grant insert, delete on public.personnel_certifications to roster_app_runtime;
drop policy if exists "native runtime personnel certification inserts" on public.personnel_certifications;
create policy "native runtime personnel certification inserts" on public.personnel_certifications for insert to roster_app_runtime with check (true);
drop policy if exists "native runtime personnel certification deletes" on public.personnel_certifications;
create policy "native runtime personnel certification deletes" on public.personnel_certifications for delete to roster_app_runtime using (true);

