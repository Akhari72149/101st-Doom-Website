drop policy if exists "native runtime attendance reads" on public.attendance_records;
create policy "native runtime attendance reads"
  on public.attendance_records for select to roster_app_runtime using (true);

drop policy if exists "native runtime attendance updates" on public.attendance_records;
create policy "native runtime attendance updates"
  on public.attendance_records for update to roster_app_runtime using (true) with check (true);

